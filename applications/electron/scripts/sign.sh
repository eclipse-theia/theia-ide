#!/bin/bash -x

# Enable debug output
set -x

INPUT=$1
ENTITLEMENTS=$2
NEEDS_UNZIP=false

echo "=== DEBUG: Starting signing process for $INPUT ==="

# if folder, zip it
if [ -d "${INPUT}" ]; then
    echo "=== DEBUG: Input is a directory, zipping it ==="
    NEEDS_UNZIP=true
    zip -r -q -y unsigned.zip "${INPUT}"
    rm -rf "${INPUT}"
    INPUT=unsigned.zip
fi

# copy file to storage server
echo "=== DEBUG: Copying $INPUT to storage server ==="
scp -p "${INPUT}" genie.theia@projects-storage.eclipse.org:./
if [ $? -eq 0 ]; then
    echo "=== DEBUG: Successfully copied $INPUT to storage server ==="
else
    echo "=== ERROR: Failed to copy $INPUT to storage server ==="
    exit 1
fi
rm -f "${INPUT}"

# copy entitlements to storage server
echo "=== DEBUG: Copying entitlements file to storage server ==="
scp -p "${ENTITLEMENTS}" genie.theia@projects-storage.eclipse.org:./entitlements.plist
if [ $? -eq 0 ]; then
    echo "=== DEBUG: Successfully copied entitlements to storage server ==="
else
    echo "=== ERROR: Failed to copy entitlements to storage server ==="
    exit 1
fi

# name to use on server
REMOTE_NAME=${INPUT##*/}

# sign over ssh
# https://wiki.eclipse.org/IT_Infrastructure_Doc#Web_service
ssh -q genie.theia@projects-storage.eclipse.org curl -f -o "\"signed-${REMOTE_NAME}\"" -F file=@"\"${REMOTE_NAME}\"" -F entitlements=@entitlements.plist https://cbi.eclipse.org/macos/codesign/sign
if [ $? -eq 0 ]; then
    echo "=== DEBUG: Remote signing completed successfully ==="
else
    echo "=== ERROR: Remote signing failed ==="
    # Try to get error information
    ssh -q genie.theia@projects-storage.eclipse.org "cat \"signed-${REMOTE_NAME}\" || echo 'No output file found'"
    exit 1
fi

# copy signed file back from server
echo "=== DEBUG: Copying signed file back from storage server ==="
scp -T -p genie.theia@projects-storage.eclipse.org:"\"./signed-${REMOTE_NAME}\"" "${INPUT}"
if [ $? -eq 0 ]; then
    echo "=== DEBUG: Successfully retrieved signed file ==="
else
    echo "=== ERROR: Failed to retrieve signed file ==="
    exit 1
fi

# Check if the file was actually signed
echo "=== DEBUG: Verifying if file was signed properly ==="
if [ -f "${INPUT}" ]; then
    # Get file size to verify it's not empty
    FILE_SIZE=$(stat -f%z "${INPUT}" 2>/dev/null || stat -c%s "${INPUT}" 2>/dev/null)
    echo "=== DEBUG: Signed file size: $FILE_SIZE bytes ==="
    
    # On macOS, we can verify code signature
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "=== DEBUG: Checking code signature with codesign -vv ==="
        codesign -vv "${INPUT}" || echo "=== WARNING: codesign verification failed ==="
    fi
else
    echo "=== ERROR: Signed file not found ==="
    exit 1
fi

# ensure storage server is clean
echo "=== DEBUG: Cleaning up remote files ==="
ssh -q genie.theia@projects-storage.eclipse.org rm -f "\"${REMOTE_NAME}\"" "\"signed-${REMOTE_NAME}\"" entitlements.plist
echo "=== DEBUG: Remote cleanup completed ==="

# if unzip needed
if [ "$NEEDS_UNZIP" = true ]; then
    echo "=== DEBUG: Unzipping signed archive ==="
    unzip -qq "${INPUT}"

    if [ $? -ne 0 ]; then
        # echo contents if unzip failed
        echo "=== ERROR: Unzip failed, showing file contents ==="
        output=$(cat $INPUT)
        echo "$output"
        exit 1
    fi

    echo "=== DEBUG: Unzip successful, removing zip file ==="
    rm -f "${INPUT}"

    # Perform deep codesign check on the directory if running on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "=== DEBUG: Performing deep codesign verification on directory ==="
        # Check if spctl is available (macOS security assessment tool)
        if command -v spctl &> /dev/null; then
            # Check if the directory is an app bundle
            if [[ -d "$1" && "$1" == *.app ]]; then
                echo "=== DEBUG: Verifying app bundle with spctl --assess --verbose ==="
                spctl --assess --verbose "$1" || echo "=== WARNING: App bundle verification failed, may not pass notarization ==="
            fi
        fi
        
        # Find all binary files and check their signatures
        echo "=== DEBUG: Checking individual binary signatures in $1 ==="
        find "$1" -type f -exec file {} \; | grep -E "Mach-O|dylib" | cut -d: -f1 | while read binary; do
            echo "Checking signature for $binary"
            codesign --verify --deep --strict --verbose=2 "$binary" || echo "=== WARNING: Binary $binary has signature issues, may not pass notarization ==="
            
            # Check for hardened runtime
            codesign -d --verbose=4 "$binary" 2>&1 | grep -q 'Runtime Version=10.0.0' || echo "=== WARNING: Binary $binary may not have hardened runtime enabled ==="
        done
    fi
fi

echo "=== DEBUG: Signing process completed for $1 ==="