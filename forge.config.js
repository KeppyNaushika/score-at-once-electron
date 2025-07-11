module.exports = {
  packagerConfig: {
    asar: true,
    name: "Score at Once",
    executableName: "score-at-once",
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "Score at Once",
        exe: "score-at-once.exe",
        setupExe: "ScoreAtOnce-Setup.exe",
        noMsi: true,
      },
      platforms: ['win32'],
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'win32'],
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
      config: {},
    },
  ],
};
