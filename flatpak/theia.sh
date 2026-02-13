#!/bin/sh

# It is important to set --electronUserData and THEIA_CONFIG_DIR
# to the same paths in both the sandbox and the native run! Otherwise
# settings and workspaces won't be shared.
# Since this is a Flatpak, everything will be stored within the Flatpak directory structure.

default_args="--ozone-platform-hint=auto --electronUserData=$XDG_DATA_HOME"
readonly extra_args="$*"

launch_sandboxed() {
    default_args="$default_args --no-sandbox"
    THEIA_CONFIG_DIR="$XDG_CONFIG_HOME" \
        exec zypak-wrapper /app/share/theia/theia-ide-electron-app.bin $default_args $extra_args
}

if [ -n "$THEIA_NO_ESCAPE_FLATPAK" ]; then
    launch_sandboxed
fi

echo "Escaping the Flatpak sandbox…"

launch_native() {
    readonly executable_path="files/share/theia/theia-ide-electron-app.bin"
    readonly lib_path="files/lib"
    location="$1"

    LD_LIBRARY_PATH="${location}/${lib_path}:${LD_LIBRARY_PATH}" \
        exec flatpak-spawn \
            --env=THEIA_CONFIG_DIR="$XDG_CONFIG_HOME" \
            --host "${location}/${executable_path}" $default_args $extra_args
}

location="$(flatpak-spawn --host flatpak info --show-location "$FLATPAK_ID")"
if [ $? != 0 ]; then
    echo "Failed to get Theia installation path within Flatpak" >&2
    launch_sandboxed
fi
launch_native "$location"

echo "Failed to escape the Flatpak sandbox" >&2
launch_sandboxed
