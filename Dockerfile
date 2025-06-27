# See the associated GitHub workflow, that builds and publishes
# this docker image to Docker Hub:
# .github/workflows/publish-builder-img.yml
# It can be triggered manually from the GitHub project page. 

# We want to support as many Debian versions as possible.
# Therefore, use the oldest Debian release that still provides the desired Node.js version.
FROM node:22.15-bullseye
RUN apt-get update && apt-get install -y libxkbfile-dev libsecret-1-dev python3