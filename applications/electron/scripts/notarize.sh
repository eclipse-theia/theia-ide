#!/bin/bash -x

INPUT=$1
APP_ID=$2
NEEDS_UNZIP=false
UUID_REGEX='"uuid"\s*:\s*"([^"]+)'
STATUS_REGEX='"status"\s*:\s*"([^"]+)'

# if folder, zip it
if [ -d "${INPUT}" ]; then
    NEEDS_UNZIP=true
    zip -r -q -y unsigned.zip "${INPUT}"
    rm -rf "${INPUT}"
    INPUT=unsigned.zip
fi

# copy file to storage server
scp -O -p "${INPUT}" genie.theia@projects-storage.eclipse.org:./
rm -f "${INPUT}"

# name to use on server
REMOTE_NAME=${INPUT##*/}

# notarize over ssh
RESPONSE=$(ssh -q genie.theia@projects-storage.eclipse.org curl -X POST -F file=@"\"${REMOTE_NAME}\"" -F "'options={\"primaryBundleId\": \"${APP_ID}\", \"staple\": true};type=application/json'" https://cbi.eclipse.org/macos/xcrun/notarize)

# fund uuid and status
[[ $RESPONSE =~ $UUID_REGEX ]]
UUID=${BASH_REMATCH[1]}
[[ $RESPONSE =~ $STATUS_REGEX ]]
STATUS=${BASH_REMATCH[1]}

# poll progress
echo "  Progress: $RESPONSE"
while [[ $STATUS == 'IN_PROGRESS' ]]; do
    sleep 120
    RESPONSE=$(ssh -q genie.theia@projects-storage.eclipse.org curl -s https://cbi.eclipse.org/macos/xcrun/${UUID}/status)
    [[ $RESPONSE =~ $STATUS_REGEX ]]
    STATUS=${BASH_REMATCH[1]}
    echo "  Progress: $RESPONSE"
done

if [[ $STATUS != 'COMPLETE' ]]; then
    echo "Notarization failed: $RESPONSE"
    exit 1
fi

# download stapled result
ssh -q genie.theia@projects-storage.eclipse.org curl -o "\"stapled-${REMOTE_NAME}\"" https://cbi.eclipse.org/macos/xcrun/${UUID}/download

# copy stapled file back from server
scp -O -T -p genie.theia@projects-storage.eclipse.org:"\"./stapled-${REMOTE_NAME}\"" "${INPUT}"

# ensure storage server is clean
ssh -q genie.theia@projects-storage.eclipse.org rm -f "\"${REMOTE_NAME}\"" "\"stapled-${REMOTE_NAME}\"" entitlements.plist

# if unzip needed
if [ "$NEEDS_UNZIP" = true ]; then
    unzip -qq "${INPUT}"

    if [ $? -ne 0 ]; then
        # echo contents if unzip failed
        output=$(cat $INPUT)
        echo "$output"
        exit 1
    fi

    rm -f "${INPUT}"
fi
