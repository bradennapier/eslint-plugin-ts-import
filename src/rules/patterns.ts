/* eslint-disable no-param-reassign */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// type-only import - fixed by https://github.com/benmosher/eslint-plugin-import/pull/1820
// eslint-disable-next-line import/no-extraneous-dependencies
import type { TSESTree } from '@typescript-eslint/experimental-utils';
import debug from 'debug';

import * as eslint from 'eslint';

import * as fpath from 'path';

import minimatch from 'minimatch';

import { createImportRuleListener } from '../utils';
import { resolve } from '../configPaths';

const log = debug('eslint-plugin-ts-import');

interface ImportPatternsConfig {
  target: string;
  re: RegExp;
  allowed: string | Array<string | [RegExp, string]>;
  modules?: boolean;
  message?: string;
}

export default class ImportPatternsRule implements eslint.Rule.RuleModule {
  readonly meta: eslint.Rule.RuleMetaData = {
    messages: {
      badImportCustomMessage: "{{message}} (allowed: '{{allowed}}')",
      badImport:
        "This import violates the provided import-patterns (allowed: '{{allowed}}')",
    },
    docs: {
      url: 'https://github.com/bradennapier/eslint-plugin-ts-import',
    },
  };

  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const configs = <ImportPatternsConfig[]>context.options;
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

    const importPath = resolve(path, fileName, null).path;

    let matched =
      config.modules !== false && importPath?.includes('node_modules');

    log('Initial Matched? ', { importPath, matched });

    if (!matched) {
      log('Checking: ', { path, importPath, allowed });
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
          // console.log({ newPattern });
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
}
