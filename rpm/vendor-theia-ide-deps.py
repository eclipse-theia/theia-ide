#!/usr/bin/env python3
"""
Generate source tarballs for Theia IDE RPM builds.

Per Fedora Node.js packaging guidelines, this creates:
  - theia-ide-{version}.tar.gz (main source with submodules)
  - theia-ide-plugins-{version}.tar.xz (VSIX extensions)
  - theia-ide-deps-{version}.tar.xz (bundled node dependencies and electron binaries)
  - theia-ide-deps-{version}.json (generated sources metadata for reference)

This script uses flatpak-node-generator (same as the flatpak build) to generate
a list of all dependencies, then downloads them and bundles into a tarball.
This simplifies maintenance and ensures consistency between build systems.

By default, all sources (main, plugins, and dependencies) are generated. Use the
--skip-* or --only-* flags to generate specific tarballs only.

Requirements:
  - python3, pipx, git, curl
  - flatpak-node-generator: Auto-installed via pipx if not present

Reference: https://docs.fedoraproject.org/en-US/packaging-guidelines/Node.js/

Usage:
  ./vendor-theia-ide-deps.py [options] [version]

Options:
  -v, --version VER      Specify version (default: local package.json)
  -o, --output DIR       Output directory (default: current directory)
  --github-latest        Fetch latest version from GitHub instead of using local
  --skip-main-source     Skip main source tarball generation
  --skip-plugins         Skip plugins tarball generation
  --skip-deps            Skip dependency tarball generation
  --only-main-source     Only generate main source tarball
  --only-plugins         Only generate plugins tarball
  --only-deps            Only generate deps tarball
  --no-update-spec       Do not update spec file variables
  --copr                 COPR mode: output to $COPR_RESULTDIR, copy spec/patches, and
                         infer Release number from existing COPR builds (since
                         %autorelease doesn't work with Custom Source Method)
  -h, --help             Show this help message

Note: Dependencies are always downloaded for all supported architectures (x86_64, aarch64)
to create a universal bundle that works on any supported platform.

Examples:
  ./vendor-theia-ide-deps.py                    # Generate all sources using local package.json version
  ./vendor-theia-ide-deps.py --github-latest    # Generate all sources for latest GitHub tag
  ./vendor-theia-ide-deps.py 1.67.100           # Generate all sources for specific version
  ./vendor-theia-ide-deps.py -o ./dist          # Output to specific directory
  ./vendor-theia-ide-deps.py --only-plugins     # Only generate plugins tarball
  ./vendor-theia-ide-deps.py --skip-main-source # Generate plugins and deps only
  ./vendor-theia-ide-deps.py --only-main-source # Only generate main source tarball
"""

import argparse
import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path


def get_current_arch():
    """Map platform.machine() to flatpak arch names."""
    machine = platform.machine()
    arch_map = {
        'x86_64': 'x86_64',
        'aarch64': 'aarch64',
        'arm64': 'aarch64',  # macOS uses arm64
        'armv7l': 'arm',
        'i686': 'i386',
    }
    return arch_map.get(machine, machine)


def verify_sha256(filepath, expected_sha256):
    """Verify SHA256 checksum of a file."""
    sha256 = hashlib.sha256()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            sha256.update(chunk)
    return sha256.hexdigest() == expected_sha256


def download_file(url, dest_path, expected_sha256=None):
    """Download a file with optional SHA256 verification."""
    dest_path = Path(dest_path)
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    # Check if file already exists and is valid
    if dest_path.exists():
        if expected_sha256 and verify_sha256(dest_path, expected_sha256):
            print(f"  ✓ Already downloaded: {dest_path.name}")
            return True
        elif not expected_sha256:
            print(f"  ✓ Already exists: {dest_path.name}")
            return True
        else:
            print(f"  ✗ Checksum mismatch, re-downloading: {dest_path.name}")
            dest_path.unlink()

    # Download the file
    try:
        print(f"  ⬇ Downloading: {dest_path.name}")
        with urllib.request.urlopen(url) as response:
            with open(dest_path, 'wb') as out_file:
                out_file.write(response.read())

        # Verify checksum
        if expected_sha256:
            if verify_sha256(dest_path, expected_sha256):
                print(f"    ✓ Verified SHA256")
            else:
                print(f"    ✗ SHA256 mismatch for {dest_path.name}", file=sys.stderr)
                dest_path.unlink()
                return False

        return True

    except Exception as e:
        print(f"    ✗ Failed to download {url}: {e}", file=sys.stderr)
        if dest_path.exists():
            dest_path.unlink()
        return False


def clone_git_repo(url, commit, dest_path):
    """Clone a git repository at a specific commit."""
    dest_path = Path(dest_path)

    # Check if already cloned
    if dest_path.exists() and (dest_path / '.git').exists():
        print(f"  ✓ Already cloned: {dest_path.name}")
        return True

    # Clean up if partial clone exists
    if dest_path.exists():
        shutil.rmtree(dest_path)

    dest_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        print(f"  ⬇ Cloning: {url}@{commit[:8]}")

        # Clone the repository
        subprocess.run(
            ['git', 'clone', '--depth', '1', url, str(dest_path)],
            check=True,
            capture_output=True
        )

        # Checkout the specific commit
        subprocess.run(
            ['git', '-C', str(dest_path), 'fetch', '--depth', '1', 'origin', commit],
            check=True,
            capture_output=True
        )
        subprocess.run(
            ['git', '-C', str(dest_path), 'checkout', commit],
            check=True,
            capture_output=True
        )

        print(f"    ✓ Cloned at commit {commit[:8]}")
        return True

    except subprocess.CalledProcessError as e:
        print(f"    ✗ Failed to clone {url}: {e}", file=sys.stderr)
        if dest_path.exists():
            shutil.rmtree(dest_path)
        return False
    except Exception as e:
        print(f"    ✗ Failed to clone {url}: {e}", file=sys.stderr)
        return False


def download_dependencies(sources_json, output_dir):
    """Download dependencies from flatpak-node-generator sources JSON.

    Downloads for all supported architectures (x86_64 and aarch64) to create
    a universal dependency bundle.

    Args:
        sources_json: Path to the sources JSON file
        output_dir: Directory to download dependencies to
    """
    # Always download for all supported architectures
    arches = ['x86_64', 'aarch64']

    with open(sources_json) as f:
        sources = json.load(f)

    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"Downloading dependencies to: {output_dir}")
    print(f"Architectures: {', '.join(arches)} (all supported)")
    print()

    success_count = 0
    skip_count = 0
    fail_count = 0
    git_count = 0

    for source in sources:
        source_type = source.get('type')

        # Handle git sources
        if source_type == 'git':
            url = source.get('url')
            commit = source.get('commit')
            dest = source.get('dest')

            if not url or not commit or not dest:
                continue

            dest_path = output_dir / dest

            if clone_git_repo(url, commit, dest_path):
                git_count += 1
                success_count += 1
            else:
                fail_count += 1
            continue

        # Handle file sources
        if source_type == 'file':
            # Check architecture filters
            only_arches = source.get('only-arches', [])

            if only_arches:
                # If the source has architecture restrictions, check if any of our target arches match
                matching_arches = [arch for arch in arches if arch in only_arches]
                if not matching_arches:
                    skip_count += 1
                    continue
            # If no architecture filter, download once for all arches

            url = source.get('url')
            dest_filename = source.get('dest-filename')
            dest_subdir = source.get('dest', '')
            sha256 = source.get('sha256')

            if not url or not dest_filename:
                continue

            # Construct destination path
            dest_path = output_dir / dest_subdir / dest_filename

            # Download and verify
            if download_file(url, dest_path, sha256):
                success_count += 1
            else:
                fail_count += 1

    print()
    print("=== Download Summary ===")
    print(f"  Downloaded: {success_count - git_count} files")
    print(f"  Cloned: {git_count} git repositories")
    print(f"  Skipped (arch): {skip_count}")
    print(f"  Failed: {fail_count}")

    if fail_count > 0:
        print()
        print("Some downloads failed. Please check the errors above.", file=sys.stderr)
        return False

    print()
    return True


def get_latest_github_version():
    """Fetch the latest version from GitHub tags.

    Uses the tags API since the repository uses pre-releases which don't
    appear in the /releases/latest endpoint.
    """
    try:
        url = 'https://api.github.com/repos/eclipse-theia/theia-ide/tags'
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read())
            if data and len(data) > 0:
                # Get the first (most recent) tag
                tag = data[0].get('name', '')
                # Remove 'v' prefix if present
                return tag.lstrip('v') if tag else None
            return None
    except Exception as e:
        print(f"Warning: Failed to fetch latest version from GitHub: {e}", file=sys.stderr)
        return None


def get_version_from_local(project_root):
    """Get version from local package.json."""
    package_json = project_root / 'package.json'
    if package_json.exists():
        try:
            with open(package_json) as f:
                data = json.load(f)
                return data.get('version')
        except Exception as e:
            print(f"Warning: Failed to read version from package.json: {e}", file=sys.stderr)
    return None


def create_tarball(source_dir, output_path, compression='gz'):
    """Create a compressed tarball from a directory."""
    mode_map = {
        'gz': 'w:gz',
        'xz': 'w:xz',
        'bz2': 'w:bz2',
    }
    mode = mode_map.get(compression, 'w:gz')

    with tarfile.open(output_path, mode) as tar:
        tar.add(source_dir, arcname=source_dir.name)

    print(f"    Created: {output_path.name}")


def get_versions_from_package_json(package_json_path):
    """Extract theia and electron versions from package.json."""
    if not package_json_path.exists():
        return None, None

    try:
        with open(package_json_path) as f:
            data = json.load(f)

        # Get theia version from dependencies
        theia_version = None
        deps = data.get('dependencies', {})
        dev_deps = data.get('devDependencies', {})

        # Look for @theia/core or similar packages
        for dep_name, dep_version in {**deps, **dev_deps}.items():
            if dep_name.startswith('@theia/'):
                # Remove ^ or ~ prefix if present
                theia_version = dep_version.lstrip('^~')
                break

        # Get electron version - check multiple locations
        electron_version = None

        # First try root package.json devDependencies
        electron_dep = dev_deps.get('electron', deps.get('electron'))
        if electron_dep:
            electron_version = electron_dep.lstrip('^~')

        # If not found, check applications/electron/package.json
        if not electron_version:
            electron_pkg = package_json_path.parent / 'applications' / 'electron' / 'package.json'
            if electron_pkg.exists():
                try:
                    with open(electron_pkg) as f:
                        electron_data = json.load(f)
                    electron_deps = electron_data.get('dependencies', {})
                    electron_dev_deps = electron_data.get('devDependencies', {})
                    electron_dep = electron_dev_deps.get('electron', electron_deps.get('electron'))
                    if electron_dep:
                        electron_version = electron_dep.lstrip('^~')
                except Exception as e:
                    print(f"Warning: Failed to parse electron package.json: {e}", file=sys.stderr)

        return theia_version, electron_version

    except Exception as e:
        print(f"Warning: Failed to parse package.json: {e}", file=sys.stderr)
        return None, None


def get_copr_release_number(version, copr_owner='lorbus', copr_project='theia', package_name='theia-ide'):
    """Query COPR dist-git to determine the next release number for a version.

    In COPR mode with Custom Source Method, %autorelease doesn't work, so we need
    to manually determine the release number by checking the previous build in dist-git.

    Args:
        version: The package version (e.g., "1.67.100")
        copr_owner: COPR username
        copr_project: COPR project name
        package_name: Package name

    Returns:
        Next release number as integer, or 1 if no builds exist for this version
    """
    # Explicitly request master branch to get the latest committed spec file
    distgit_url = f'https://copr-dist-git.fedorainfracloud.org/packages/{copr_owner}/{copr_project}/{package_name}.git/plain/{package_name}.spec?h=master'

    print(f"    Querying COPR dist-git for previous version of {package_name}...", flush=True)

    try:
        # Fetch the spec file from dist-git (using /plain/ endpoint for raw file)
        # Use curl as urllib gets blocked by bot protection
        if shutil.which('curl'):
            try:
                result = subprocess.run(
                    ['curl', '-s', '-f', '-L', distgit_url],
                    capture_output=True,
                    timeout=10,
                    check=True
                )
                content = result.stdout.decode('utf-8')
            except (subprocess.CalledProcessError, subprocess.TimeoutExpired) as e:
                raise Exception(f"curl failed: {e}")
        else:
            # Fallback to urllib (may be blocked by bot protection)
            req = urllib.request.Request(distgit_url)
            req.add_header('User-Agent', 'Mozilla/5.0 (compatible; theia-ide-vendor/1.0)')

            with urllib.request.urlopen(req, timeout=10) as response:
                content = response.read().decode('utf-8')

                # Check if we got bot protection page
                if content.startswith('<!doctype html>') or content.startswith('<html'):
                    raise Exception("Received HTML (bot protection), install curl for better results")

        # Parse Version and Release from the spec file
        # Note: spec files may use tabs or multiple spaces for alignment
        version_match = re.search(r'^Version:\s+(\S+)', content, re.MULTILINE)
        release_match = re.search(r'^Release:\s+(\d+)', content, re.MULTILINE)

        if not version_match or not release_match:
            print(f"    Warning: Could not parse Version/Release from dist-git spec file", file=sys.stderr)
            print(f"    Defaulting to release 1", file=sys.stderr)
            return 1

        prev_version = version_match.group(1).strip()
        prev_release = int(release_match.group(1))

        if prev_version == version:
            # Same version, increment release
            next_release = prev_release + 1
            print(f"    ✓ Previous build: {prev_version}-{prev_release}, using release {next_release}", flush=True)
        else:
            # Different version, reset to release 1
            next_release = 1
            print(f"    ✓ Previous build: {prev_version}-{prev_release}, new version detected, using release {next_release}", flush=True)

        return next_release

    except Exception as e:
        print(f"    Warning: Failed to query COPR dist-git: {e}", file=sys.stderr)
        print(f"    This is normal for the first build or when dist-git is unavailable.", file=sys.stderr)
        print(f"    Defaulting to release 1", file=sys.stderr)
        return 1


def update_spec_file(spec_file, version, theia_version=None, electron_version=None, release=None):
    """Update version variables in the spec file.

    Args:
        spec_file: Path to the spec file
        version: Package version
        theia_version: Theia framework version (optional)
        electron_version: Electron version (optional)
        release: Release number (optional, for COPR mode)
    """
    if not spec_file.exists():
        print(f"Warning: Spec file not found at {spec_file}", file=sys.stderr)
        return False

    print(f">>> Updating spec file: {spec_file.name}")

    with open(spec_file) as f:
        content = f.read()

    original_content = content

    # Update Version field
    content = re.sub(
        r'^Version:\s+.*$',
        f'Version:        {version}',
        content,
        flags=re.MULTILINE
    )

    # Update Release field if provided (COPR mode)
    if release is not None:
        content = re.sub(
            r'^Release:\s+.*$',
            f'Release:        {release}%{{?dist}}',
            content,
            flags=re.MULTILINE
        )

    # Update theia_version if provided
    if theia_version:
        content = re.sub(
            r'^%global theia_version\s+.*$',
            f'%global theia_version {theia_version}',
            content,
            flags=re.MULTILINE
        )

    # Update electron_version if provided
    if electron_version:
        content = re.sub(
            r'^%global electron_version\s+.*$',
            f'%global electron_version {electron_version}',
            content,
            flags=re.MULTILINE
        )

    if content != original_content:
        with open(spec_file, 'w') as f:
            f.write(content)

        print(f"    ✓ Updated Version: {version}")
        if release is not None:
            print(f"    ✓ Updated Release: {release}%{{?dist}}")
        if theia_version:
            print(f"    ✓ Updated theia_version: {theia_version}")
        if electron_version:
            print(f"    ✓ Updated electron_version: {electron_version}")
        print()
        return True
    else:
        print("    No changes needed")
        print()
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Generate source tarballs for Theia IDE RPM builds',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument('version', nargs='?', help='Version to build (default: local package.json)')
    parser.add_argument('-v', '--version-arg', dest='version_opt', help='Specify version')
    parser.add_argument('-o', '--output', help='Output directory (default: current directory)')
    parser.add_argument('--github-latest', action='store_true', help='Fetch latest version from GitHub instead of using local')
    parser.add_argument('--skip-main-source', action='store_true', help='Skip main source tarball generation')
    parser.add_argument('--skip-plugins', action='store_true', help='Skip plugins tarball generation')
    parser.add_argument('--skip-deps', action='store_true', help='Skip dependency tarball generation')
    parser.add_argument('--only-main-source', action='store_true', help='Only generate main source tarball')
    parser.add_argument('--only-plugins', action='store_true', help='Only generate plugins tarball')
    parser.add_argument('--only-deps', action='store_true', help='Only generate deps tarball')
    parser.add_argument('--copr', action='store_true', help='COPR mode: output to $COPR_RESULTDIR and copy spec/patches')
    parser.add_argument('--no-update-spec', action='store_true', help='Do not update spec file variables')
    args = parser.parse_args()

    # Determine version
    script_dir = Path(__file__).parent.resolve()
    project_root = script_dir.parent  # Parent of rpm/ directory

    # Version priority: explicit argument > --github-latest flag > local package.json
    version = args.version_opt or args.version

    if not version:
        if args.github_latest:
            # Fetch latest from GitHub tags
            print("Fetching latest version from GitHub...")
            version = get_latest_github_version()
            if not version:
                print("Error: Cannot fetch version from GitHub.", file=sys.stderr)
                sys.exit(1)
            print(f"Using latest GitHub version: {version}")
            print()
        else:
            # Get version from local package.json (default behavior)
            print("Using version from local package.json...")
            version = get_version_from_local(project_root)
            if not version:
                print("Error: Cannot find version in local package.json.", file=sys.stderr)
                print("Use --github-latest to fetch from GitHub or specify version explicitly.", file=sys.stderr)
                sys.exit(1)
            print(f"Using local version: {version}")
            print()

    # Determine what to generate
    if args.only_main_source:
        gen_main = True
        gen_plugins = False
        gen_deps = False
    elif args.only_plugins:
        gen_main = False
        gen_plugins = True
        gen_deps = False
    elif args.only_deps:
        gen_main = False
        gen_plugins = False
        gen_deps = True
    else:
        # Default: generate all, unless individually skipped
        gen_main = not args.skip_main_source
        gen_plugins = not args.skip_plugins
        gen_deps = not args.skip_deps

    copr_mode = args.copr

    # Determine output directory
    if args.output:
        output_dir = Path(args.output)
    elif copr_mode:
        # COPR sets COPR_RESULTDIR, but also try resultdir for compatibility
        output_dir = Path(os.environ.get('COPR_RESULTDIR', os.environ.get('resultdir', '/workdir/rpm')))
    else:
        output_dir = Path('.')

    output_dir = output_dir.resolve()  # Make absolute
    output_dir.mkdir(parents=True, exist_ok=True)

    # In COPR mode, determine the release number early
    release = None
    if copr_mode:
        print("=== Theia IDE Source Generator (COPR Mode) ===", flush=True)
        print(f"Version: {version}", flush=True)
        print(flush=True)
        release = get_copr_release_number(version)
        print(f"Release: {release}", flush=True)
        print(flush=True)
    else:
        print("=== Theia IDE Source Generator ===", flush=True)
        print(f"Version: {version}", flush=True)
        print(flush=True)

    print(f"Output: {output_dir}", flush=True)
    print(flush=True)

    # Create temporary working directory
    with tempfile.TemporaryDirectory() as workdir:
        workdir = Path(workdir)

        # Clone and create main source tarball if requested
        if gen_main:
            print(">>> Cloning theia-ide repository with submodules...")
            clone_dir = workdir / f'theia-ide-{version}'

            try:
                subprocess.run(
                    ['git', 'clone', '--depth', '1', '--branch', f'v{version}',
                     '--recurse-submodules', 'https://github.com/eclipse-theia/theia-ide.git',
                     str(clone_dir)],
                    check=True
                )

                print(">>> Cleaning up .git directories...")
                for git_dir in clone_dir.rglob('.git'):
                    if git_dir.is_dir():
                        shutil.rmtree(git_dir)

                print(">>> Creating main source tarball (with submodule content)...")
                output_tarball = output_dir / f'theia-ide-{version}.tar.gz'
                create_tarball(clone_dir, output_tarball, 'gz')
                print()

                src_dir = clone_dir

            except subprocess.CalledProcessError as e:
                print(f"Error: Failed to clone repository: {e}", file=sys.stderr)
                sys.exit(1)
        else:
            # Use existing local checkout for reading package.json and yarn.lock
            src_dir = project_root

        # Generate plugins tarball
        if gen_plugins:
            plugin_dir = workdir / f'theia-ide-plugins-{version}'
            plugin_dir.mkdir(parents=True, exist_ok=True)

            print(">>> Downloading Theia plugins from package.json...")
            package_json = src_dir / 'package.json'
            with open(package_json) as f:
                data = json.load(f)
                plugins = data.get('theiaPlugins', {})

            for name, url in plugins.items():
                filename = os.path.basename(url)
                print(f"    {filename}")
                dest_path = plugin_dir / filename
                if not download_file(url, dest_path):
                    print(f"Warning: Failed to download {filename}", file=sys.stderr)

            print(">>> Downloading VS Code built-in extensions...")
            extension_sources = src_dir / 'flatpak' / 'extension-sources.json'
            if extension_sources.exists():
                with open(extension_sources) as f:
                    data = json.load(f)

                for item in data:
                    if item.get('type') == 'file' and item.get('dest') == 'plugins':
                        url = item['url']
                        filename = item['dest-filename']
                        print(f"    {filename}")
                        dest_path = plugin_dir / filename
                        if not download_file(url, dest_path, item.get('sha256')):
                            print(f"Warning: Failed to download {filename}", file=sys.stderr)

            print(">>> Creating plugins tarball...")
            plugins_tarball = output_dir / f'theia-ide-plugins-{version}.tar.xz'
            create_tarball(plugin_dir, plugins_tarball, 'xz')
            print()

        # Generate dependency tarball
        if gen_deps:
            print(">>> Generating dependency tarball with flatpak-node-generator...")

            # Check if flatpak-node-generator is available
            if not shutil.which('flatpak-node-generator'):
                print("flatpak-node-generator not found. Installing via pipx...")

                # Check if pipx is available
                if not shutil.which('pipx'):
                    print("Error: pipx not found. Please install pipx first:", file=sys.stderr)
                    print("  https://pipx.pypa.io/stable/installation/", file=sys.stderr)
                    sys.exit(1)

                try:
                    subprocess.run(
                        # https://github.com/flatpak/flatpak-builder-tools/pull/495
                        ['pipx', 'install', 'git+https://github.com/LorbusChris/flatpak-builder-tools.git@ripgrep-fix#subdirectory=node'],
                        check=True
                    )
                    print("    ✓ Successfully installed flatpak-node-generator")

                    # Update PATH to include pipx bin directory
                    home = Path.home()
                    pipx_bin = home / '.local' / 'bin'
                    if pipx_bin.exists():
                        os.environ['PATH'] = f"{pipx_bin}:{os.environ.get('PATH', '')}"
                        print(f"    ✓ Updated PATH to include {pipx_bin}")

                except subprocess.CalledProcessError as e:
                    print(f"Error: Failed to install flatpak-node-generator: {e}", file=sys.stderr)
                    print("  You can try installing manually with:", file=sys.stderr)
                    print("  pipx install 'git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node'", file=sys.stderr)
                    sys.exit(1)

                # Verify installation
                if not shutil.which('flatpak-node-generator'):
                    print("Error: flatpak-node-generator still not found after installation.", file=sys.stderr)
                    print("  Please check your PATH and ensure pipx installed it correctly.", file=sys.stderr)
                    print(f"  PATH: {os.environ.get('PATH')}", file=sys.stderr)
                    sys.exit(1)

            # Generate sources JSON
            temp_deps_json = workdir / f'deps-{version}.json'
            yarn_lock = src_dir / 'yarn.lock'

            print("    Analyzing yarn.lock and generating sources...")
            try:
                subprocess.run(
                    ['flatpak-node-generator', 'yarn', str(yarn_lock),
                     '--electron-ffmpeg', 'archive',
                     '-o', str(temp_deps_json)],
                    check=True
                )
            except subprocess.CalledProcessError as e:
                print(f"Error: flatpak-node-generator failed: {e}", file=sys.stderr)
                sys.exit(1)

            # Download all dependencies
            deps_dir = workdir / f'theia-ide-deps-{version}'
            deps_dir.mkdir(parents=True, exist_ok=True)

            print(">>> Downloading dependencies...")
            print("    (This may take several minutes)")
            if not download_dependencies(temp_deps_json, deps_dir):
                print("Error: Failed to download dependencies", file=sys.stderr)
                sys.exit(1)

            # Create tarball
            print(">>> Creating dependency tarball...")
            deps_tarball = output_dir / f'theia-ide-deps-{version}.tar.xz'
            create_tarball(deps_dir, deps_tarball, 'xz')

            # Save JSON for reference
            shutil.copy(temp_deps_json, output_dir / f'theia-ide-deps-{version}.json')
            print(f"    Created: theia-ide-deps-{version}.json (for reference)")
            print()

        # Update spec file with version information unless disabled
        if not args.no_update_spec:
            # Find spec file location
            spec_file = script_dir / 'theia-ide.spec'
            if spec_file.exists():
                # Get versions from package.json
                package_json = src_dir / 'package.json'
                theia_version, electron_version = get_versions_from_package_json(package_json)

                # Update spec file (release was determined earlier if in COPR mode)
                update_spec_file(spec_file, version, theia_version, electron_version, release)

        # Copy spec file and patches in COPR mode
        if copr_mode:
            print(">>> Copying spec file and patches...")

            # Try multiple locations for the spec file
            spec_locations = [
                script_dir / 'theia-ide.spec',
                src_dir / 'rpm' / 'theia-ide.spec',
                Path('theia-ide.spec'),
            ]

            spec_file = None
            for location in spec_locations:
                if location.exists():
                    spec_file = location
                    break

            if spec_file:
                shutil.copy(spec_file, output_dir)
                print(f"    ✓ Copied spec file from {spec_file}")

                # Find the directory containing the spec file (where patches likely are)
                spec_dir = spec_file.parent

                # Copy all patch files from the same directory
                patch_files = list(spec_dir.glob('*.patch'))
                for patch in patch_files:
                    shutil.copy(patch, output_dir)
                    print(f"    ✓ Copied patch: {patch.name}")

                if not patch_files:
                    print("    (No patch files found)")

                print()
            else:
                print("Warning: Could not find theia-ide.spec file", file=sys.stderr)
                print(f"  Searched: {', '.join(str(loc) for loc in spec_locations)}", file=sys.stderr)
                print()

    # Print summary
    print("=== Summary ===")
    print(f"Output directory: {output_dir.resolve()}")
    print()

    generated_files = []
    for pattern in ['theia-ide-*.tar.*', 'theia-ide-*.json', '*.spec']:
        generated_files.extend(sorted(output_dir.glob(pattern)))

    if generated_files:
        print("Generated files:")
        for f in generated_files:
            print(f"  {f.name}")

        print()
        print("SHA256 checksums:")
        for f in generated_files:
            if f.suffix not in ['.spec']:
                sha256 = hashlib.sha256()
                with open(f, 'rb') as file:
                    for chunk in iter(lambda: file.read(8192), b''):
                        sha256.update(chunk)
                print(f"  {sha256.hexdigest()}  {f.name}")
    else:
        print("Warning: No files generated!", file=sys.stderr)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n!!! Fatal error: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)
