module.exports = {
  branches: ['master'],
  plugins: [
    '@semantic-release/commit-analyzer',         // step 1: figure out version bump
    '@semantic-release/release-notes-generator', // step 2: generate notes
    [
      '@semantic-release/changelog',             // step 3: write notes into CHANGELOG.md
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# Changelog'
      }
    ],
    [
      '@semantic-release/git',                   // step 4: commit changelog + version.json
      {
        assets: ['CHANGELOG.md', 'version.json', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]'
      }
    ],
    '@semantic-release/github'                   // step 5: create GitHub release with notes
  ]
};
