<div align="center">
  <h1>
    <br/>
    <br/>
    <p align="center">
      <img src="docs/img/style.png" width="400" title="eslint-plugin-ts-import">
    </p>
    <br />
    eslint-plugin-ts-import
    <br />
    <br />
    <br />
    <br />
  </h1>
  <sup>
    <br />
    <br />
    <a href="https://www.npmjs.com/package/eslint-plugin-ts-import">
       <img src="https://img.shields.io/npm/v/eslint-plugin-ts-import.svg" alt="npm package" />
    </a>
    <!-- TODO
     <a href="https://www.npmjs.com/package/eslint-plugin-ts-import">
      <img src="https://img.shields.io/npm/dm/eslint-plugin-ts-import.svg" alt="npm downloads" />
    </a>
    -->
    <!-- TODO
    <a href="http://bradennapier.github.io/eslint-plugin-ts-import">
      <img src="https://img.shields.io/badge/demos-🚀-yellow.svg" alt="demos" />
    </a>
    -->
    <br />
    Define specific import rules for files within your <a href="https://www.typescriptlang.org/index.html"> Typescript </a> project.  Adapted and enhanced from <a href="https://github.com/microsoft/vscode">VSCode's</a> <a href="https://github.com/microsoft/vscode/blob/master/build/lib/eslint/code-import-patterns.ts">code-import-patterns</a>
  </sup>
  <br />
  <br />
  <br />
  <br />
  <pre>yarn add --dev <a href="https://www.npmjs.com/package/eslint-plugin-ts-import">eslint-plugin-ts-import</a></pre>
  <br />
  <br />
  <br />
  <br />
  <br />
</div>

## Features

- Provide import patterns that restrict imports of certain files based on location.
- Ensure imports meet the expected guidelines within your repo.
- Adapted from VSCode's rule `code-import-patterns`.
- Provide custom eslint messaging for each pattern if needed.
- Useful in monorepos and most Typescript projects which utilize incremental builds.

## Simple Example

```javascript
// .eslintrc.js

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.lint.json',
    sourceType: 'module',
  },
  rules: {
    'ts-import/patterns': [
      'error',
      {
        // these rules apply to any files which are within the src/services directory
        target: '**/src/services/*/**',
        // allow any imports to node_modules.  We confirm that the node_module exists in case the use of paths / absolute imports is used so that
        // we can tell the difference
        modules: true,
        allowed: [
          // anything in src/services/{service}/** may import config `import config from 'config'`
          'config',

          // anything in src/services/{service}/** may import from core `import someModule from 'core/someModule'`
          'core/**',

          // run target.replace(arr[0], arr[1]) to build pattern
          // any service may import from itself - so src/services/rest-api/** may always import from `src/services/rest-api/**`
          // whether using relative or absolute imports.  However it will not be able to import from `../api-client/**` or `services/api-client/**`
          [/.*\/src\/services\/([^/]*)\/.*/, '**/src/services/$1/**'],

          // allow any imports whether relative or absolute as long as they are not higher than /src/services
          [/(.*\/src\/services).*/, '$1/**'],

          // this rule without the above rule would only allow the files to import themselves or higher and would restrict `../`
          './**',
        ],
        message:
          'Optional custom message to display when violated',
      },
    ],
  },
  plugins: ['ts-import'],
  settings: {
    'import/resolver': {
      typescript: {
        directory: 'tsconfig.lint.json',
      },
    },
  },
}
```
