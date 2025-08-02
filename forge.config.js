module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules,.next,main,sharp,@prisma,.prisma}/**/*"
    },
    asarUnpack: [
      "**/.next/**/*",
      "**/node_modules/**/*",
      "**/main/**/*", 
      "**/@prisma/**/*",
      "**/.prisma/**/*"
    ],
    name: "一括採点",
    executableName: "score-at-once",
    icon: "./public/icons/icon.icns", // macOS用に明示的に指定
    osxSign: false,
    osxNotarize: false,
    ignore: [
      /^\/src/, 
      /^\/\.git/,
      /^\/docs/,
      /^\/scripts/,
      /^\/out/,
      /^\/temp-test/,
      /^\/dist/,
      /^\/temp-prisma-backup/
    ],
    extraResource: [
      ".next",
      "public"
    ]
  },
  rebuildConfig: {
    buildPath: "./out",
    electronVersion: "37.1.0",
    onlyModules: ["sharp"],
    forceABI: true
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
      config: {
        darwin: {
          options: {
            name: "一括採点.app"
          }
        },
        win32: {
          options: {
            name: "一括採点.exe"
          }
        }
      }
    },
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          icon: "./public/icons/icon-win.png"
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: "./public/icons/icon-win.png"
        }
      }
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {
        unpackNatives: true
      },
    },
  ],
  hooks: {
    postPackage: async (forgeConfig, options) => {
      const fs = require('fs')
      const path = require('path')
      const { spawnSync } = require('child_process')
      
      if (options.platform === 'darwin') {
        const appPath = path.join(options.outputPaths[0], `${forgeConfig.packagerConfig.name}.app`)
        const resourcesPath = path.join(appPath, 'Contents', 'Resources')
        const infoPlistPath = path.join(appPath, 'Contents', 'Info.plist')
        
        // カスタムアイコンをコピー
        const iconSource = path.join(__dirname, 'public', 'icons', 'icon.icns')
        const iconDest = path.join(resourcesPath, 'icon.icns')
        
        if (fs.existsSync(iconSource)) {
          fs.copyFileSync(iconSource, iconDest)
          console.log('✓ カスタムアイコンをコピーしました')
          
          // Info.plistを更新
          spawnSync('plutil', ['-replace', 'CFBundleIconFile', '-string', 'icon.icns', infoPlistPath])
          console.log('✓ Info.plistを更新しました')
        }
      }
    }
  },
};
