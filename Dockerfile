# See the associated GitHub workflow, that builds and publishes
# this docker image to Docker Hub:
# .github/workflows/publish-builder-img.yml
# It can be triggered manually from the GitHub project page. 

# We still want Ubuntu 20.04 LTS compatibility, which is based on bullseye
# -> buster is old enough
FROM node:22.15.1-buster
RUN apt-get update && apt-get install -y libxkbfile-dev libsecret-1-dev python3