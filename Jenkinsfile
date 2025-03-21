/**
 * This Jenkinsfile builds Theia across the major OS platforms
 */

/* groovylint-disable NestedBlockDepth */
import groovy.json.JsonSlurper

releaseBranch = "master"
distFolder = "applications/electron/dist"

toStashDist = "${distFolder}/**"
toStashDistMac = "${distFolder}/mac-x64/**"
toStashDistMacArm = "${distFolder}/mac-arm64/**"
toStashDistInstallers = "${distFolder}/*"
// default folder to stash
toStash = toStashDistInstallers

// Attempt to detect whether a PR is Jenkins-related, by looking-for
// the word "jenkins" (case insensitive) in PR branch name and/or
// the PR title
jenkinsRelatedRegex = "(?i).*jenkins.*"

pipeline {
    agent none
    options {
        timeout(time: 5, unit: 'HOURS')
        disableConcurrentBuilds()
    }
    environment {
        THEIA_IDE_JENKINS_CI = 'true'

        // to save time and resources, we skip some release-related steps
        // when not in the process of releasing. e.g. signing/notarizing the
        // installers. It can sometimes be necessary to run these steps, e.g.
        // when troubleshooting. Set the variable below to 'true' to do so.
        // We will still stop short of publishing anything.
        THEIA_IDE_JENKINS_RELEASE_DRYRUN = 'false'
        // THEIA_IDE_JENKINS_RELEASE_DRYRUN = 'true'
        msvs_version = '2019'
        GYP_MSVS_VERSION = '2019'

        NODE_OPTIONS = '--max_old_space_size=4096'
    }
    stages {
        stage('Build') {
            when {
                anyOf {
                    expression {
                        env.JOB_BASE_NAME ==~ /$releaseBranch/
                    }
                    expression { 
                        env.CHANGE_BRANCH ==~ /$jenkinsRelatedRegex/
                    }
                    expression {
                        env.CHANGE_TITLE ==~ /$jenkinsRelatedRegex/
                    }
                    expression {
                        // PR branch? 
                        env.BRANCH_NAME ==~ /PR-(\d)+/
                    }
                    expression {
                        env.THEIA_IDE_JENKINS_RELEASE_DRYRUN == 'true'
                    }
                }
            }
            parallel {
                stage('Create Linux Installer') {
                    agent {
                        kubernetes {
                            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: theia-dev
    image: eclipsetheia/theia-blueprint:builder
    imagePullPolicy: Always
    command:
    - cat
    tty: true
    resources:
      limits:
        memory: "8Gi"
        cpu: "2"
      requests:
        memory: "8Gi"
        cpu: "2"
    volumeMounts:
    - name: global-cache
      mountPath: /.cache
    - name: global-yarn
      mountPath: /.yarn      
    - name: global-npm
      mountPath: /.npm      
    - name: electron-cache
      mountPath: /.electron-gyp
  volumes:
  - name: global-cache
    emptyDir: {}
  - name: global-yarn
    emptyDir: {}
  - name: global-npm
    emptyDir: {}
  - name: electron-cache
    emptyDir: {}
"""
                        }
                    }
                    steps {
                        container('theia-dev') {
                            withCredentials([string(credentialsId: "github-bot-token", variable: 'GITHUB_TOKEN')]) {
                                script {
                                    buildInstaller(120)
                                }
                            }
                        }
                        stash includes: "${toStash}", name: 'linux'
                    }
                    post {
                        failure {
                            error("Linux installer creation failed, aborting...")
                        }
                    }
                }
                stage('Create Mac Installer') {
                    options {
                        skipDefaultCheckout true
                    }
                    agent {
                        label 'macos'
                    }
                    steps {
                        script {
                            createMacInstaller()
                        }
                        stash includes: "${toStashDist}", name: 'mac'
                    }
                    post {
                        failure {
                            error("Mac installer creation failed, aborting...")
                        }
                    }
                }
                stage('Create Windows Installer') {
                    agent {
                        label 'windows'
                    }
                    steps {                 
                        nodejs(nodeJSInstallationName: 'node_20.x') {
                            sh "node --version"
                            sh "npx node-gyp@9.4.1 install 20.11.1"

                            // analyze memory usage
                            bat "wmic ComputerSystem get TotalPhysicalMemory"
                            bat "wmic OS get FreePhysicalMemory"
                            bat "tasklist"

                            buildInstaller(60)
                        }
                        stash includes: "${toStash}", name: 'win'
                    }
                    post {
                        failure {
                            error("Windows installer creation failed, aborting...")
                        }
                    }
                }
            }
        }
        stage('Sign and Upload') {
            // only proceed when merging on the release branch or if the
            // PR seems Jenkins-related. Note: for PRs, we do not by default
            // run this stage since it will be of little practical value.
            when {
                anyOf {
                    expression {
                        env.JOB_BASE_NAME ==~ /$releaseBranch/
                    }
                    expression { 
                        env.CHANGE_BRANCH ==~ /$jenkinsRelatedRegex/
                    }
                    expression {
                        env.CHANGE_TITLE ==~ /$jenkinsRelatedRegex/
                    }
                    expression {
                        env.THEIA_IDE_JENKINS_RELEASE_DRYRUN == 'true'
                    }
                }
            }
            parallel {
                stage('Upload Linux') {
                    agent any
                    steps {
                        unstash 'linux'
                        script {
                            uploadInstaller('linux')
                        }
                    }
                }
                stage('Sign, Notarize and Upload Mac') {
                    stages {
                        stage('Sign and Notarize Mac') {
                            agent {
                                kubernetes {
                                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: theia-dev
    image: eclipsetheia/theia-blueprint:builder
    imagePullPolicy: Always
    command:
    - cat
    tty: true
    resources:
      limits:
        memory: "8Gi"
        cpu: "2"
      requests:
        memory: "8Gi"
        cpu: "2"
    volumeMounts:
    - name: global-cache
      mountPath: /.cache
    - name: global-yarn
      mountPath: /.yarn      
    - name: global-npm
      mountPath: /.npm      
    - name: electron-cache
      mountPath: /.electron-gyp
  - name: jnlp
    volumeMounts:
    - name: volume-known-hosts
      mountPath: /home/jenkins/.ssh
  volumes:
  - name: global-cache
    emptyDir: {}
  - name: global-yarn
    emptyDir: {}
  - name: global-npm
    emptyDir: {}
  - name: electron-cache
    emptyDir: {}
  - name: volume-known-hosts
    configMap:
      name: known-hosts
"""
                                }
                            }
                            steps {
                                unstash 'mac'
                                container('theia-dev') {
                                    withCredentials([string(credentialsId: "github-bot-token", variable: 'GITHUB_TOKEN')]) {
                                        script {
                                            signInstaller('dmg', 'mac', 'mac-x64')
                                            notarizeInstaller('dmg', 'mac-x64')
                                            signInstaller('dmg', 'mac', 'mac-arm64')
                                            notarizeInstaller('dmg', 'mac-arm64')
                                        }
                                    }
                                }
                                stash includes: "${toStashDistMac}", name: 'mac2'
                                stash includes: "${toStashDistMacArm}", name: 'mac2-arm'
                            }
                        }
                        stage('Recreate Zip with Ditto for correct file permissions') {
                            agent {
                                label 'macos'
                            }
                            steps {
                                unstash 'mac2'
                                unstash 'mac2-arm'
                                script {
                                    def packageJSON = readJSON file: "package.json"
                                    String version = "${packageJSON.version}"

                                    def architectures = ['mac-x64', 'mac-arm64']
                                    architectures.each { arch -> 

                                        String targetFolder = "${distFolder}/${arch}"
                                        def notarizedDmg = "${targetFolder}/TheiaIDE.dmg"

                                        // We'll mount and then copy the .app out of the DMG
                                        def mountPoint = "${targetFolder}/TheiaIDE-mount"
                                        def extractedFolder = "${targetFolder}/TheiaIDE-extracted"
                                        def rezippedFile = "${targetFolder}/TheiaIDE-rezipped.zip"
                                        def archSuffix = arch == 'mac-arm64' ? '-arm64' : ''
                                        def finalZip = "${targetFolder}/TheiaIDE-${version}${archSuffix}-mac.zip"
                                        sh "rm -rf \"${extractedFolder}\" \"${mountPoint}\""
                                        sh "mkdir -p \"${extractedFolder}\" \"${mountPoint}\""
                                        sh "hdiutil attach \"${notarizedDmg}\" -mountpoint \"${mountPoint}\""

                                        sleep 5
                                        sh "ls -al ${mountPoint}"
                                        sh "ls -al ${mountPoint}/TheiaIDE.app"

                                        // Copy the .app from the DMG to a folder we can zip
                                        sh "ditto \"${mountPoint}/TheiaIDE.app\" \"${extractedFolder}/TheiaIDE.app\""

                                        // Unmount the DMG
                                        sh "hdiutil detach \"${mountPoint}\""

                                        // Zip with ditto
                                        sh "ditto -c -k \"${extractedFolder}\" \"${rezippedFile}\""

                                        // Replace the old zip with the newly created one
                                        sh "rm -f \"${finalZip}\""
                                        sh "mv \"${rezippedFile}\" \"${finalZip}\""

                                        // Cleanup
                                        sh "rm -rf \"${extractedFolder}\" \"${mountPoint}\""
                                    }


                                }
                                stash includes: "${toStashDistMac}", name: 'mac3'
                                stash includes: "${toStashDistMacArm}", name: 'mac3-arm'
                            }
                        }
                        stage('Update Metadata and Upload Mac') {
                            agent {
                                kubernetes {
                                    yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: theia-dev
    image: eclipsetheia/theia-blueprint:builder
    imagePullPolicy: Always
    command:
    - cat
    tty: true
    resources:
      limits:
        memory: "8Gi"
        cpu: "2"
      requests:
        memory: "8Gi"
        cpu: "2"
    volumeMounts:
    - name: global-cache
      mountPath: /.cache
    - name: global-yarn
      mountPath: /.yarn      
    - name: global-npm
      mountPath: /.npm      
    - name: electron-cache
      mountPath: /.electron-gyp
  - name: jnlp
    volumeMounts:
    - name: volume-known-hosts
      mountPath: /home/jenkins/.ssh
  volumes:
  - name: global-cache
    emptyDir: {}
  - name: global-yarn
    emptyDir: {}
  - name: global-npm
    emptyDir: {}
  - name: electron-cache
    emptyDir: {}
  - name: volume-known-hosts
    configMap:
      name: known-hosts
"""
                                }
                            }
                            steps {
                                unstash 'mac3'
                                unstash 'mac3-arm'
                                container('theia-dev') {
                                    withCredentials([string(credentialsId: "github-bot-token", variable: 'GITHUB_TOKEN')]) {
                                        script {
                                            def packageJSON = readJSON file: "package.json"
                                            String version = "${packageJSON.version}"
                                            updateMetadata('mac-x64/TheiaIDE-' + version + '-mac.zip', 'mac-x64/latest-mac.yml', 'macos', false, '.zip', 1200)
                                            updateMetadata('mac-x64/TheiaIDE.dmg', 'mac-x64/latest-mac.yml', 'macos', false, '.dmg', 1200)
                                            updateMetadata('mac-arm64/TheiaIDE-' + version + '-arm64-mac.zip', 'mac-arm64/latest-mac.yml', 'macos-arm', false, '.zip', 1200)
                                            updateMetadata('mac-arm64/TheiaIDE.dmg', 'mac-arm64/latest-mac.yml', 'macos-arm', false, '.dmg', 1200)
                                        }
                                    }
                                }
                                container('jnlp') {
                                    script {
                                        uploadInstaller('macos', 'mac-x64')
                                        uploadInstaller('macos-arm', 'mac-arm64')
                                    }
                                }
                            }
                        }
                    }
                }
                stage('Sign and Upload Windows') {
                    agent {
                        kubernetes {
                            yaml """
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: theia-dev
    image: eclipsetheia/theia-blueprint:builder
    imagePullPolicy: Always
    command:
    - cat
    tty: true
    resources:
      limits:
        memory: "8Gi"
        cpu: "2"
      requests:
        memory: "8Gi"
        cpu: "2"
    volumeMounts:
    - name: global-cache
      mountPath: /.cache
    - name: global-yarn
      mountPath: /.yarn      
    - name: global-npm
      mountPath: /.npm      
    - name: electron-cache
      mountPath: /.electron-gyp
  - name: jnlp
    volumeMounts:
    - name: volume-known-hosts
      mountPath: /home/jenkins/.ssh
  volumes:
  - name: global-cache
    emptyDir: {}
  - name: global-yarn
    emptyDir: {}
  - name: global-npm
    emptyDir: {}
  - name: electron-cache
    emptyDir: {}
  - name: volume-known-hosts
    configMap:
      name: known-hosts
"""
                        }
                    }
                    steps {
                        unstash 'win'
                        container('theia-dev') {
                            withCredentials([string(credentialsId: "github-bot-token", variable: 'GITHUB_TOKEN')]) {
                                script {
                                    signInstaller('exe', 'windows')
                                    updateMetadata('TheiaIDESetup.exe', 'latest.yml', 'windows', true, '.exe', 1200)
                                }
                            }
                        }
                        container('jnlp') {
                            script {
                                echo 'Computing updatable versions before uploading new installer'
                                def updatableVersions = getUpdatableVersions()
                                echo 'updatableVersions: ' + updatableVersions
                                uploadInstaller('windows')
                                copyInstallerAndUpdateLatestYml('windows', 'TheiaIDESetup', 'exe', 'latest.yml', updatableVersions)
                            }
                        }
                    }
                }
            }
        }
    }
}

def detachVolume(String mountpoint) {
    try {
        sh "hdiutil detach \"${mountpoint}\" -force"
    } catch (Exception ex) {
        echo "Failed to detach ${mountpoint}: ${ex}"
    }
}

def createMacInstaller() {
    // Step 0: Clean up any previously mounted DMG files and only then checkout scm
    def pathToMacArm64 = "/${pwd()}/applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted"
    def pathToMacX64 = "/${pwd()}/applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted"
    def path2ToMacArm64 = "/${pwd()}/applications/electron/dist/mac-arm64/TheiaIDE-mount"
    def path2ToMacX64 = "/${pwd()}/applications/electron/dist/mac-x64/TheiaIDE-mount"
    detachVolume(pathToMacArm64)
    detachVolume(pathToMacX64)
    detachVolume(path2ToMacArm64)
    detachVolume(path2ToMacX64)
    checkout scm

    // Step 1: Ensure the directory exists
    sh 'mkdir -p applications/electron/dist'

    // Step 2: Download the zip files
    sh 'curl -L -o applications/electron/dist/mac-arm64.zip https://github.com/eclipse-theia/theia-ide/releases/download/pre-release/mac-arm64.zip'
    sh 'curl -L -o applications/electron/dist/mac-x64.zip https://github.com/eclipse-theia/theia-ide/releases/download/pre-release/mac-x64.zip'

    // Step 3: Extract the zip files
    sh 'unzip applications/electron/dist/mac-arm64.zip -d applications/electron/dist/mac-arm64'
    sh 'unzip applications/electron/dist/mac-x64.zip -d applications/electron/dist/mac-x64'

    // Step 4: Delete the zip files
    sh 'rm applications/electron/dist/mac-arm64.zip applications/electron/dist/mac-x64.zip'

    // Step 5: List contents to verify
    sh 'ls -al applications/electron/dist/mac-arm64 applications/electron/dist/mac-x64'

    // Step 6: Unpack DMG files for signing
    sh 'rm -rf applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted'
    sh 'mkdir -p applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted'
    sh 'hdiutil attach applications/electron/dist/mac-arm64/TheiaIDE.dmg -mountpoint applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted'
    sh 'hdiutil attach applications/electron/dist/mac-x64/TheiaIDE.dmg -mountpoint applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted'
    sh 'mkdir -p applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/.background'
    sh 'mkdir -p applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/.background'
    sh '''
        if [ -f applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted/.DS_Store ]; then
            cp applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted/.DS_Store applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/
        fi
    '''
    sh '''
        if [ -f applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted/.DS_Store ]; then
            cp applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted/.DS_Store applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/
        fi
    '''
    sh 'cp -R applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted/TheiaIDE.app applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/TheiaIDE.app'
    sh 'cp -R applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted/TheiaIDE.app applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/TheiaIDE.app'
    sh 'ln -s /Applications applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/Applications'
    sh 'ln -s /Applications applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/Applications'
    sh 'hdiutil detach applications/electron/dist/mac-arm64/TheiaIDE-dmg-mounted'
    sh 'hdiutil detach applications/electron/dist/mac-x64/TheiaIDE-dmg-mounted'
    sh 'ls -al applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout applications/electron/dist/mac-x64/TheiaIDE-dmg-layout'
    sh 'ls -al applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/TheiaIDE.app applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/TheiaIDE.app'

    // Step 7: Remove quarantine bits from all files
    sh 'xattr -d -r com.apple.quarantine applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout || true'
    sh 'xattr -d -r com.apple.quarantine applications/electron/dist/mac-x64/TheiaIDE-dmg-layout || true'
    
    // Step 8: Sign binaries - only when it's a release
    if (isRelease()) {
        sh 'yarn --frozen-lockfile --force'
        sshagent(['projects-storage.eclipse.org-bot-ssh']) {
            def appPathArm64 = "/${pwd()}/applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/TheiaIDE.app"
            def appPathX64 = "/${pwd()}/applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/TheiaIDE.app"
            sh "yarn electron sign:directory -d \"${appPathArm64}\""
            sh "yarn electron sign:directory -d \"${appPathX64}\""
        }
    } else {
        echo "This is not a release, so skipping binary signing for branch ${env.BRANCH_NAME}"
    }
    sh 'ls -al applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout applications/electron/dist/mac-x64/TheiaIDE-dmg-layout'
    sh 'ls -al applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout/TheiaIDE.app applications/electron/dist/mac-x64/TheiaIDE-dmg-layout/TheiaIDE.app'

    // Step 9: Remove existing DMG files
    sh 'rm -f applications/electron/dist/mac-arm64/TheiaIDE.dmg applications/electron/dist/mac-x64/TheiaIDE.dmg'

    // Step 10: Create the final DMG
    sh 'hdiutil create -volname TheiaIDE -srcfolder applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout -fs HFS+ -format UDZO applications/electron/dist/mac-arm64/TheiaIDE.dmg'
    sh 'hdiutil create -volname TheiaIDE -srcfolder applications/electron/dist/mac-x64/TheiaIDE-dmg-layout -fs HFS+ -format UDZO applications/electron/dist/mac-x64/TheiaIDE.dmg'

    // Step 11: Cleanup TheiaIDE-dmg-layout
    sh 'rm -rf applications/electron/dist/mac-arm64/TheiaIDE-dmg-layout applications/electron/dist/mac-x64/TheiaIDE-dmg-layout'

    // Step 12: Cleanup files we don't require
    sh 'find applications/electron/dist/mac-arm64 -type f ! -name "TheiaIDE.dmg" ! -name "latest-mac.yml" -delete'
    sh 'find applications/electron/dist/mac-x64 -type f ! -name "TheiaIDE.dmg" ! -name "latest-mac.yml" -delete'
    sh 'ls -al applications/electron/dist/mac-arm64 applications/electron/dist/mac-x64'
}

def buildInstaller(int sleepBetweenRetries) {
    int maxRetry = 1
    String buildPackageCmd

    checkout scm

    // only build the Electron app for now
    buildPackageCmd = 'yarn --frozen-lockfile --force && \
        yarn build:extensions && yarn electron build'

    if (isRelease()) {
        // when not a release, build dev to save time
        buildPackageCmd += ":prod"
    }

    sh 'node --version'
    sh 'printenv && yarn cache dir'
    try {
        sh(script: buildPackageCmd)
    } catch (error) {
        retry(maxRetry) {
            sleep(sleepBetweenRetries)
            echo 'yarn failed - Retrying'
            sh(script: buildPackageCmd)
        }
    }

    sshagent(['projects-storage.eclipse.org-bot-ssh']) {
        if (isRelease()) {
            sh 'yarn download:plugins && yarn electron package:prod'
        } else {
            // ATM the plugins are not useful for non-releases, so
            // let's skip ketching them
            sh 'yarn electron package:preview'
        }
    }
}

def signInstaller(String ext, String os, String arch = '') {
    if (!isRelease()) {
        echo "This is not a release, so skipping installer signing for branch ${env.BRANCH_NAME}"
        return
    }

    // Adjust the dist folder to include architecture if supplied
    String targetFolder = arch ? "${distFolder}/${arch}" : distFolder
    List installers = findFiles(glob: "${targetFolder}/*.${ext}")

    // https://wiki.eclipse.org/IT_Infrastructure_Doc#Web_service
    if (os == 'mac') {
        url = 'https://cbi.eclipse.org/macos/codesign/sign'
    } else if (os == 'windows') {
        url = 'https://cbi.eclipse.org/authenticode/sign'
    } else {
        error("Error during signing: unsupported OS: ${os}")
    }

    if (installers.size() == 1) {
        sh "curl -o ${targetFolder}/signed-${installers[0].name} -F file=@${installers[0].path} ${url}"
        sh "rm ${installers[0].path}"
        sh "mv ${targetFolder}/signed-${installers[0].name} ${installers[0].path}"
    } else {
        error("Error during signing: installer not found or multiple installers exist: ${installers.size()}")
    }
}

def notarizeInstaller(String ext, String arch = '') {
    if (!isRelease()) {
        echo "This is not a release, so skipping installer notarizing for branch ${env.BRANCH_NAME}"
        return
    }

    String service = 'https://cbi.eclipse.org/macos/xcrun'

    // Adjust the dist folder to include architecture if supplied
    String targetFolder = arch ? "${distFolder}/${arch}" : distFolder
    List installers = findFiles(glob: "${targetFolder}/*.${ext}")

    if (installers.size() == 1) {
        String response = sh(script: "curl -X POST -F file=@${installers[0].path} -F \'options={\"primaryBundleId\": \"eclipse.theia\", \"staple\": true};type=application/json\' ${service}/notarize", returnStdout: true)

        def jsonSlurper = new JsonSlurper()
        def json = jsonSlurper.parseText(response)
        String uuid = json.uuid

        while(json.notarizationStatus.status == 'IN_PROGRESS') {
            sh "sleep 60"
            response = sh(script: "curl ${service}/${uuid}/status", returnStdout: true)
            json = jsonSlurper.parseText(response)
        }

        if (json.notarizationStatus.status != 'COMPLETE') {
            error("Failed to notarize ${installers[0].name}: ${response}")
        }

        sh "curl -o ${targetFolder}/stapled-${installers[0].name} ${service}/${uuid}/download"
        sh "rm ${installers[0].path}"
        sh "mv ${targetFolder}/stapled-${installers[0].name} ${installers[0].path}"
    } else {
        error("Error during notarization: installer not found or multiple installers exist: ${installers.size()}")
    }
}

def updateMetadata(String executable, String yaml, String platform, Boolean updatePaths, String fileExtension, int sleepBetweenRetries) {
    if (!isRelease()) {
        echo "This is not a release, so skipping updating metadata for branch ${env.BRANCH_NAME}"
        return
    }

    int maxRetry = 4
    try {
        // make sure the npm dependencies are available to the update scripts
        sh "yarn install --force"
        sh "yarn electron update:blockmap -e ${executable}"
        sh "yarn electron update:checksum -e ${executable} -y ${yaml} -p ${platform} -u ${updatePaths} -f ${fileExtension}"
    } catch (error) {
        retry(maxRetry) {
            sleep(sleepBetweenRetries)
            echo "yarn failed - Retrying"
            sh "yarn install --force"
            sh "yarn electron update:blockmap -e ${executable}"
        sh "yarn electron update:checksum -e ${executable} -y ${yaml} -p ${platform} -u ${updatePaths} -f ${fileExtension}"
        }
    }
}

def uploadInstaller(String platform, String arch = '') {
    if (isReleaseBranch()) {
        String targetFolder = arch ? "${distFolder}/${arch}" : distFolder
        def packageJSON = readJSON file: "package.json"
        String version = "${packageJSON.version}"
        sshagent(['projects-storage.eclipse.org-bot-ssh']) {
            sh "ssh genie.theia@projects-storage.eclipse.org rm -rf /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}"
            sh "ssh genie.theia@projects-storage.eclipse.org mkdir -p /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}"
            sh "scp ${targetFolder}/*.* genie.theia@projects-storage.eclipse.org:/home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}"
            sh "ssh genie.theia@projects-storage.eclipse.org rm -rf /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}"
            sh "ssh genie.theia@projects-storage.eclipse.org mkdir -p /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}"
            sh "scp ${targetFolder}/*.* genie.theia@projects-storage.eclipse.org:/home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}"
        }
    } else {
        echo "Skipped upload for branch ${env.BRANCH_NAME}"
    }
}

/**
 * List all directories in the ide-preview directory. 
 * Only takes the ones with a version identifier name. 
 * Only take version numbers lower than the current version. 
 */
def getUpdatableVersions() {
    def packageJSON = readJSON file: "package.json"
    String currentVersion = "${packageJSON.version}"
    
    def versions = ''
    
    sshagent(['projects-storage.eclipse.org-bot-ssh']) {
        versions = sh(
            script: """
            ssh genie.theia@projects-storage.eclipse.org "cd /home/data/httpd/download.eclipse.org/theia/ide-preview/ && \
            find . -maxdepth 1 -type d -regex '.*/[0-9]+\\.[0-9]+\\.[0-9]+' -exec basename {} \\; | sort -V | awk -v curVer='${currentVersion}' '{
                if (\\\$1 != curVer && \\\$1 < curVer) print \\\$1
            }' | paste -sd ','"
            """,
            returnStdout: true
        ).trim()
    }
    
    return versions
}

/**
 * Currently we have the windows updater available twice with different names. 
 * We want to have a name without the versions for providing a stable download link. 
 * Due to a bug in the nsis-updater the downloaded exe for an update needs to have a different name than initially however.
 */
def copyInstallerAndUpdateLatestYml(String platform, String installer, String extension, String yaml, String UPDATABLE_VERSIONS) {
    if (isReleaseBranch()) {
        def packageJSON = readJSON file: "package.json"
        String version = "${packageJSON.version}"
        sshagent(['projects-storage.eclipse.org-bot-ssh']) {
            sh "ssh genie.theia@projects-storage.eclipse.org cp /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}/${installer}.${extension} /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}/${installer}-${version}.${extension}"
            sh "ssh genie.theia@projects-storage.eclipse.org cp /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}/${installer}.${extension} /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}/${installer}-${version}.${extension}"
            sh "ssh genie.theia@projects-storage.eclipse.org cp /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}/${installer}.${extension}.blockmap /home/data/httpd/download.eclipse.org/theia/ide-preview/latest/${platform}/${installer}-${version}.${extension}.blockmap"
            sh "ssh genie.theia@projects-storage.eclipse.org cp /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}/${installer}.${extension}.blockmap /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}/${installer}-${version}.${extension}.blockmap"
        }
        if (UPDATABLE_VERSIONS.length() != 0) {
            for (oldVersion in UPDATABLE_VERSIONS.split(",")) {
                sshagent(['projects-storage.eclipse.org-bot-ssh']) {
                    sh "ssh genie.theia@projects-storage.eclipse.org rm -f /home/data/httpd/download.eclipse.org/theia/ide-preview/${oldVersion}/${platform}/${yaml}"
                    sh "ssh genie.theia@projects-storage.eclipse.org cp /home/data/httpd/download.eclipse.org/theia/ide-preview/${version}/${platform}/${yaml} /home/data/httpd/download.eclipse.org/theia/ide-preview/${oldVersion}/${platform}/${yaml}"
                }
            }
        } else {
            echo "No updateable versions"
        }
    } else {
        echo "Skipped copying installer for branch ${env.BRANCH_NAME}"
    }
}

def isReleaseBranch() {
    return (env.BRANCH_NAME == releaseBranch)
}

def isDryRunRelease() {
    return env.THEIA_IDE_JENKINS_RELEASE_DRYRUN == 'true'
}

def isRelease() {
    return isDryRunRelease() || isReleaseBranch()
}
