/* eslint-disable no-param-reassign */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as eslint from 'eslint';
import { TSESTree } from '@typescript-eslint/experimental-utils';
import * as fpath from 'path';
import minimatch from 'minimatch';
// import * as tsHelpers from '@zerollup/ts-helpers';
import { ImportPathInternalResolver } from '../importHelpers';

import { createImportRuleListener } from '../utils';

interface ImportPatternsConfig {
  target: string;
  re: RegExp;
  allowed: string | Array<string | [RegExp, string]>;
  modules?: boolean;
  message?: string;
}

export default new (class implements eslint.Rule.RuleModule {
  private importResolver: ImportPathInternalResolver | undefined;

  readonly meta: eslint.Rule.RuleMetaData = {
    messages: {
      badImportCustomMessage: "{{message}} (allowed: '{{allowed}}')",
      badImport:
        "This import violates the provided import-patterns (allowed: '{{allowed}}')",
    },
    docs: {
      url: 'https://github.com/bradennapier/eslint-plugin-import-patterns',
    },
  };

  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const configs = <ImportPatternsConfig[]>context.options;
    // this.pathResolver = new tsHelpers.ImportPathsResolver(
    //   context.parserServices.program.getCompilerOptions(),
    // );
    this.importResolver = new ImportPathInternalResolver(
      context.parserServices.program,
    );
    for (const config of configs) {
      if (minimatch(context.getFilename(), config.target)) {
        return createImportRuleListener((node, value) =>
          this._checkImport(context, config, node, value),
        );
      }
    }

    return {};
  }

  private _checkImport(
    context: eslint.Rule.RuleContext,
    config: ImportPatternsConfig,
    node: TSESTree.Node,
    path: string,
  ) {
    const fileName = context.getFilename();
    const dirName = fpath.dirname(fileName);

    let relativePath: string | undefined;
    // resolve relative paths
    if (path[0] === '.') {
      relativePath = path;
      path = fpath.resolve(dirName, path);
    }

    let allowed: Array<string | [RegExp, string]>;
    if (typeof config.allowed === 'string') {
      allowed = [config.allowed];
    } else {
      allowed = config.allowed;
    }

    let importPath =
      this.importResolver && this.importResolver.resolveImport(path, dirName);

    if (importPath) {
      importPath = fpath.resolve(importPath);
    }

    let matched = false;

    // check node_modules match first and allow unless set to false
    if (config.modules !== false && !relativePath) {
      if (importPath && importPath.includes('node_modules/')) {
        // confirmed
        matched = true;
      } else {
        // this should rarely occur since we should have resolved with typescript
        try {
          require.resolve(path, {
            paths: [dirName],
          });
          matched = true;
        } catch {
          // '/users/shared/development/projects/@auroradao/project9/src/node_modules/sequelize/types/index.d.ts'
          // failed to find as a node_module
        }
      }
    }

    if (!matched) {
      for (const pattern of allowed) {
        if (!relativePath && pattern === path) {
          // direct match
          matched = true;
          break;
        }
        // console.log('match check ', typeof config.re, {
        //   pattern,
        //   // resolved,
        //   path,
        //   regexp: config.re,
        //   fileName,
        //   dirName,
        //   relativePath,
        //   resolvePath: fpath.resolve(dirName, relativePath || '.'),
        //   checkPath: typeof pattern === 'string' ? fpath.join(dirName, pattern) : fileName.replace(pattern[0], pattern[1]),
        //   patternPath: `**/${path}`,
        //   importPath,
        // });
        if (pattern[0] === '.') {
          const checkPath = fpath.join(dirName, pattern as string);
          const resolvePath = fpath.resolve(dirName, relativePath || '.');
          if (
            !relativePath &&
            importPath &&
            minimatch(importPath, checkPath, { nocase: true })
          ) {
            matched = true;
            break;
          } else if (relativePath && minimatch(resolvePath, checkPath)) {
            matched = true;
            break;
          }
        } else if (Array.isArray(pattern)) {
          // regexp and replace
          // console.log('regexp!');
          const [re, replaceWith] = pattern;
          const newPattern = fileName.replace(re, replaceWith);
          console.log({ newPattern });
          if (minimatch(importPath || path, newPattern)) {
            matched = true;
            break;
          }
        } else if (minimatch(path, pattern)) {
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // None of the restrictions matched
      context.report({
        loc: node.loc,
        messageId: config.message ? 'badImportCustomMessage' : 'badImport',
        data: {
          allowed: (config.modules !== false
            ? [...allowed, 'node_modules']
            : allowed
          ).join(' or '),
          message: config.message ? `${config.message} - ` : '',
        },
      });
    }
  }
})();
