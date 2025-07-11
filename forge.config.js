module.exports = {
  packagerConfig: {
    asar: {
      unpack: "**/{node_modules/sharp,node_modules/@img}/**"
    },
    name: "Score at Once",
    executableName: "score-at-once",
    afterCopy: [
      (buildPath, electronVersion, platform, arch, callback) => {
        // Rebuild native modules for the target platform
        const { execSync } = require('child_process');
        try {
          execSync('npm rebuild --arch=' + arch, { cwd: buildPath });
          callback();
        } catch (error) {
          callback(error);
        }
      }
    ],
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
