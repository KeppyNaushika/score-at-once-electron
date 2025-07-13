module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules,.next,main,sharp}/**"
    },
    name: "一括採点",
    executableName: "一括採点",
    icon: "一括採点アイコン.png",
    ignore: [
      /^\/src/, 
      /^\/\.git/,
      /^\/docs/,
      /^\/scripts/,
      /^\/out/
    ],
    extraResource: [
      ".next"
    ]
  },
  rebuildConfig: {
    buildPath: "./out",
    electronVersion: "37.1.0",
    onlyModules: ["sharp"]
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
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
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
