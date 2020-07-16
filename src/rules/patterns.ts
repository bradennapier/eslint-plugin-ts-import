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
  /**
   * If false, core node modules such as path, fs, stream will not be allowed
   */
  node?: boolean;
  message?: string;
}

export default class ImportPatternsRule implements eslint.Rule.RuleModule {
  readonly meta: eslint.Rule.RuleMetaData = {
    messages: {
      badImportCustomMessage: "{{message}} (allowed: '{{allowed}}')",
      badImportCustomCoreMessage:
        "{{message}}, core modules may not be imported (allowed: '{{allowed}}')",
      badImportCore:
        "This import violates the provided import-patterns, core modules may not be imported  (allowed: '{{allowed}}')",
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

    const { path: importPath, core: isCoreModule } = resolve(
      path,
      fileName,
      null,
    );

    if (isCoreModule && config.node !== false) {
      return;
    }

    let matched =
      !isCoreModule &&
      config.modules !== false &&
      importPath?.includes('node_modules');

    log('Initial Matched? ', { importPath, matched, isCoreModule });

    if (!matched && !isCoreModule) {
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
      let messageId = 'badImport';
      if (isCoreModule) {
        messageId = config.message
          ? 'badImportCustomCoreMessage'
          : 'badImportCore';
      } else if (config.message) {
        messageId = 'badImportCustomMessage';
      }
      context.report({
        loc: node.loc,
        messageId,
        data: {
          allowed: [
            ...allowed,
            config.modules !== false ? '<node_modules>' : undefined,
            config.node !== false ? '<node core>' : undefined,
          ]
            .filter((s): s is string => typeof s === 'string')
            .join(' or '),

          message: config.message || '',
        },
      });
    }
  }
}
