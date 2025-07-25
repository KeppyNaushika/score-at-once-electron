module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules,.next,main,sharp,@prisma,.prisma}/**"
    },
    name: "一括採点",
    executableName: "一括採点",
    icon: "./public/一括採点アイコン.png",
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
    onlyModules: ["sharp"]
  },
  makers: [
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
      config: {
        darwin: {
          options: {
            name: "Score at Once.app"
          }
        },
        win32: {
          options: {
            name: "Score at Once.exe"
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
