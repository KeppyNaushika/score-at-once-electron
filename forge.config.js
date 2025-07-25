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
    icon: "./public/icon.png",
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
      ".next"
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
          icon: "./public/icon.png"
        }
      }
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          icon: "./public/icon.png"
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
};
