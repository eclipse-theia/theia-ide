# Load the base-ide image, only copy from here
ARG BASE_IMAGE=ghcr.io/eclipse-theia/theia-ide/base-ide:latest

FROM ${BASE_IMAGE} AS base-ide

# Load the plugin image, only copy from here
FROM node:22-bullseye AS plugin-image

WORKDIR /home/theia

# Configure to skip download of puppeteer
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Install jq for JSON merging
RUN apt-get update && apt-get install -y --no-install-recommends jq && rm -rf /var/lib/apt/lists/*

# Copy required configuration files
COPY package.json ./package.json.base
COPY images/c/package.json.patch ./package.json.patch

# Merge the base package.json with the c-specific patch using jq
RUN jq -s '.[0] + .[1]' package.json.base package.json.patch > package.json
RUN rm package.json.base package.json.patch

# Copy scripts and dependencies from base-ide needed for yarn commands
COPY --from=base-ide /home/theia/scripts /home/theia/scripts
COPY --from=base-ide /home/theia/configs /home/theia/configs
COPY --from=base-ide /home/theia/tsconfig.json /home/theia/tsconfig.json
COPY --from=base-ide /home/theia/plugins /home/theia/plugins

# Remove unnecessary files for the browser application
# Download plugins and build application production mode
# Use yarn autoclean to remove unnecessary files from package dependencies
RUN yarn --pure-lockfile --network-timeout 1000000 && \
    yarn download:plugins

# Assemble the application
# Adapted from https://github.com/ls1intum/artemis-c-docker/blob/main/Dockerfile
# Changed: Use theia user instead of artemis user, do not install python
FROM ubuntu:24.04 AS final-ide

WORKDIR /home/theia

# Copy node from plugin-image as it is required for Theia 
COPY --from=plugin-image /usr/local/bin/node /usr/local/bin/
COPY --from=plugin-image /usr/local/lib/node_modules/ /usr/local/lib/node_modules/
COPY --from=plugin-image /usr/local/lib/node_modules/ /home/theia/node_modules/
COPY --from=plugin-image /home/theia/node_modules/ /home/theia/node_modules/

# Make sure all sources are up to date
RUN apt update && \
    apt upgrade -y --autoremove && \
    apt install -y --no-install-recommends \
    findutils bzip2 e2fsprogs sudo adduser && \
    apt clean && rm -rf /var/lib/apt/lists/*

# Create theia user and directories
# Application will be copied to /home/theia
# Default workspace is located at /home/project
RUN adduser --system --group theia --uid 101
RUN chmod g+rw /home && \
    mkdir -p /home/project && \
    chown -R theia:theia /home/theia && \
    chown -R theia:theia /home/project

# Install required tools for tool creation and terminal usage inside the IDE
RUN apt-get update && \
    apt-get install -y --no-install-recommends bash gcc clang git gdb make ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Switch to Theia user
USER theia
ENV HOME=/home/theia
WORKDIR /home/theia

# Copy application from builder-stage
COPY --from=base-ide --chown=theia:theia /home/theia /home/theia

# Copy additional plugins
COPY --from=plugin-image --chown=theia:theia /home/theia/plugins /home/theia/plugins

EXPOSE 3000

# Specify default shell for Theia and the Built-In plugins directory
ENV SHELL=/bin/bash \
    THEIA_DEFAULT_PLUGINS=local-dir:/home/theia/plugins

# Use installed git instead of dugite
ENV USE_LOCAL_GIT=true

WORKDIR /home/theia/applications/browser

# Launch the backend application via node
ENTRYPOINT [ "node", "/home/theia/applications/browser/lib/backend/main.js" ]

# Arguments passed to the application
CMD [ "/home/project", "--hostname=0.0.0.0" ]