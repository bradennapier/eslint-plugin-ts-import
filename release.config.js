module.exports = {
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
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
