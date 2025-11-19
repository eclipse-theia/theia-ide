# Dependency installation stage to maximise caching
FROM node:22-bullseye AS install-deps

# Install build prerequisites only once and clean up afterwards
RUN apt-get update \
    && apt-get install -y --no-install-recommends libxkbfile-dev libsecret-1-dev jq \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/theia

# Configure to skip download of puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy only dependency manifests
COPY lerna.json ./
COPY package.json ./package.json.base
COPY images/base-ide/package.json.patch ./package.json.patch
COPY applications/browser/package.json applications/browser/
COPY theia-extensions/product/package.json theia-extensions/product/

# Merge the base package.json with the patch using jq
RUN jq -s '.[0] + .[1]' package.json.base package.json.patch > package.json.merged
RUN cp package.json.merged package.json

# Install all workspace dependencies needed for the build
RUN yarn config set network-timeout 600000 -g \
    && yarn install

# Build the browser application and download plugins
FROM install-deps AS build-stage

# Include the full repository for building
COPY . .
COPY images/base-ide/ .

# Restore the merged package.json (COPY . . overwrote it with the root package.json)
RUN cp package.json.merged package.json
RUN rm package.json.merged package.json.base package.json.patch

# Increase Node.js heap size for build process
ENV NODE_OPTIONS=--max-old-space-size=8192

# Build extensions, download plugins, and produce the browser bundle (browser-only target)
RUN rm -rf applications/electron \
        theia-extensions/launcher \
        theia-extensions/updater \
        theia-extensions/product/src/electron-main \
    && yarn build:extensions \
    && yarn download:plugins \
    && yarn browser build \
    && yarn autoclean --init \
    && echo *.ts >> .yarnclean \
    && echo *.ts.map >> .yarnclean \
    && echo *.spec.* >> .yarnclean \
    && yarn autoclean --force \
    && yarn cache clean \
    && rm -rf .git applications/electron theia-extensions/launcher theia-extensions/updater

# Final runtime stage
FROM node:22-bullseye-slim AS base-ide

# Install only the libraries required at runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsecret-1-0 libxkbfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /home/theia

# Copy the built artefacts and configuration from the build stage
COPY --from=build-stage /home/theia /home/theia