module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        config: 'cz-conventional-changelog',
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        config: 'cz-conventional-changelog',
      },
    ],
    '@semantic-release/npm',
    [
      // commits the changed files to git
      '@semantic-release/git',
      {
        assets: ['package.json'],
      },
    ],
    // creates the github release
    '@semantic-release/github',
  ],
};
