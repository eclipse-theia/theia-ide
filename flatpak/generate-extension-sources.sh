#!/bin/bash
# Script to generate the Flatpak extension sources from eclipse-theia/builtin-extension-pack
#
# Usage:
#   ./generate-extension-sources.sh          # Generate generated-extension-sources.json
#
# This script dynamically fetches the extension list from the builtin-extension-pack
# so it automatically picks up any additions or removals from upstream.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT_FILE="${SCRIPT_DIR}/generated-extension-sources.json"

# Extensions to exclude - fetched dynamically from theiaPluginsExcludeIds in package.json
# These are authentication/companion extensions not needed in Flatpak
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
EXCLUDE_IDS=($(jq -r '.theiaPluginsExcludeIds[]' "${REPO_ROOT}/package.json"))

# Fetch the builtin-extension-pack metadata to get the list of bundled extensions
echo "Fetching extension list from eclipse-theia/builtin-extension-pack..." >&2
PACK_INFO=$(curl -sL "https://open-vsx.org/api/eclipse-theia/builtin-extension-pack/latest")
PACK_VERSION=$(echo "$PACK_INFO" | jq -r '.version')
echo "Found builtin-extension-pack version: $PACK_VERSION" >&2

# Extract bundledExtensions array as "namespace/extension" pairs
EXTENSIONS=$(echo "$PACK_INFO" | jq -r '.bundledExtensions[] | "\(.namespace)/\(.extension)"' 2>/dev/null)

if [ -z "$EXTENSIONS" ]; then
  echo "ERROR: Failed to fetch bundledExtensions from builtin-extension-pack" >&2
  exit 1
fi

# Convert exclude array to a pattern for grep (namespace.extension format)
EXCLUDE_PATTERN=$(printf '%s\n' "${EXCLUDE_IDS[@]}" | paste -sd '|')

# Build JSON array of extension sources
ENTRIES="[]"

# Process each extension
while read -r ext; do
  namespace=$(echo "$ext" | cut -d/ -f1)
  name=$(echo "$ext" | cut -d/ -f2)
  ext_id="${namespace}.${name}"
  
  # Skip excluded extensions
  if echo "$ext_id" | grep -qE "^($EXCLUDE_PATTERN)$"; then
    echo "Skipping excluded extension: $ext_id" >&2
    continue
  fi
  
  echo "Fetching ${namespace}/${name}..." >&2
  
  # Get latest version info from Open VSX
  info=$(curl -sL "https://open-vsx.org/api/${namespace}/${name}/latest")
  version=$(echo "$info" | jq -r '.version')
  download_url=$(echo "$info" | jq -r '.files.download')
  sha256_url=$(echo "$info" | jq -r '.files.sha256')
  
  if [ "$download_url" != "null" ] && [ -n "$download_url" ]; then
    sha256=$(curl -sL "$sha256_url" | head -1)
    filename="${namespace}.${name}-${version}.vsix"
    
    # Add entry to JSON array
    ENTRIES=$(echo "$ENTRIES" | jq --arg url "$download_url" \
      --arg sha256 "$sha256" \
      --arg filename "$filename" \
      '. += [{
        "type": "file",
        "url": $url,
        "sha256": $sha256,
        "dest": "plugins",
        "dest-filename": $filename
      }]')
  else
    echo "ERROR: Failed to fetch ${namespace}/${name}" >&2
  fi
done <<< "$EXTENSIONS"

# Format the JSON array
FINAL_JSON=$(echo "$ENTRIES" | jq '.')

# Write to file
echo "$FINAL_JSON" > "$OUTPUT_FILE"
echo "Updated $OUTPUT_FILE with $(echo "$ENTRIES" | jq 'length') extensions (version ${PACK_VERSION})." >&2
