# See the associated GitHub workflow, that builds and publishes
# this docker image to Docker Hub:
# .github/workflows/publish-builder-img.yml
# It can be triggered manually from the GitHub project page. 

# We want to support as many Debian versions as possible.
# Therefore, use the oldest Debian release that still provides the desired Node.js version.
FROM node:24-bookworm
RUN dpkg --add-architecture i386 \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      libxkbfile-dev libsecret-1-dev python3 \
      wine wine32 wine64 \
 && rm -rf /var/lib/apt/lists/*

# UID-agnostic wine tuning. WINEPREFIX is intentionally NOT set here; callers
# must provide a writable path owned by the runtime user.
ENV WINEDLLOVERRIDES="mscoree=;mshtml=" \
    WINEDEBUG=-all
