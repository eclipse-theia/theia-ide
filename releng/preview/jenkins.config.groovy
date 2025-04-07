/**
 * Jenkins configuration for Theia IDE build, sign, and upload processes
 * This file contains common settings used across multiple Jenkinsfiles
 */

// Branch and file configuration
def config = [
    // Main configuration
    releaseBranch: "master",
    distFolder: "applications/electron/dist",
    
    // Stash paths
    toStashDist: "applications/electron/dist/**",
    toStashDistMac: "applications/electron/dist/mac-x64/**",
    toStashDistMacArm: "applications/electron/dist/mac-arm64/**",
    toStashDistInstallers: "applications/electron/dist/*",
    
    // Environment variables
    environmentVars: [
        THEIA_IDE_JENKINS_CI: 'true',
        THEIA_IDE_JENKINS_RELEASE_DRYRUN: 'false',
        NODE_OPTIONS: '--max_old_space_size=4096'
    ],
    
    // Windows specific environment variables
    windowsEnvVars: [
        msvs_version: '2019',
        GYP_MSVS_VERSION: '2019'
    ],
    
    // Kubernetes pod templates
    podTemplates: [
        standard: """
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
""",
        
        withKnownHosts: """
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
    ],
    
    // URL configurations for signing services
    signingServices: [
        mac: 'https://cbi.eclipse.org/macos/codesign/sign',
        windows: 'https://cbi.eclipse.org/authenticode/sign',
        notarize: 'https://cbi.eclipse.org/macos/xcrun'
    ]
]

// Common utility functions
def isReleaseBranch() {
    return (env.BRANCH_NAME == config.releaseBranch)
}

def isDryRunRelease() {
    return env.THEIA_IDE_JENKINS_RELEASE_DRYRUN == 'true'
}

def isRelease() {
    return isDryRunRelease() || isReleaseBranch()
}

// Return the configuration
return this