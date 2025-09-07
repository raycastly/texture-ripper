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
      '@semantic-release/npm',
      {
        npmPublish: false
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: [
          'CHANGELOG.md',
          'package.json'
        ],
        message: 'chore(release): ${nextRelease.version} [skip ci]'
      }
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          {
            path: "dist/Texture-Ripper-Setup-*.exe",
            label: "Windows Installer (v${nextRelease.version})"
          },
          {
            path: "dist/Texture-Ripper-*.zip",
            label: "Windows Portable (v${nextRelease.version})"
          },
          {
            path: "dist/latest.yml",
            label: "Auto Update Metadata"
          },
          {
            path: "dist/*.blockmap",
            label: "Blockmap Files"
          },
          {
            path: "dist/RELEASES",
            label: "Windows RELEASES file"
          }
        ]
      }
    ]
  ]
};