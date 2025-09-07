module.exports = {
  branches: ['master'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog'
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'version.json', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]'
      }
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: 'dist/Texture Ripper Setup.exe',
            label: 'Windows Installer (Texture-Ripper-Setup.exe)'
          },
          {
            path: 'dist/Texture-Ripper.zip',
            label: 'Windows Portable (Texture-Ripper.zip)'
          }
        ]
      }
    ]
  ]
};