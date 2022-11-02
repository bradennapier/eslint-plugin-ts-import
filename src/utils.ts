/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Copyright 2021 Alex Gorbatchev <alex.gorbatchev@gmail.com>
// Some code provided has been borrowed from eslint-import-resolver-typescript https://github.com/import-js/eslint-import-resolver-typescript

// type-only import - fixed by https://github.com/benmosher/eslint-plugin-import/pull/1820
// eslint-disable-next-line import/no-extraneous-dependencies
import type { TSESTree } from '@typescript-eslint/experimental-utils';

import * as eslint from 'eslint';

export function createImportRuleListener(
  validateImport: (node: TSESTree.Literal, value: string) => any,
): eslint.Rule.RuleListener {
  function _checkImport(node: TSESTree.Node | null) {
    if (node && node.type === 'Literal' && typeof node.value === 'string') {
      validateImport(node, node.value);
    }
  }

  return {
    // import ??? from 'module'
    ImportDeclaration: (node: any) => {
      _checkImport((<TSESTree.ImportDeclaration>node).source);
    },
    // import('module').then(...) OR await import('module')
    'CallExpression[callee.type="Import"][arguments.length=1] > Literal': (
      node: any,
    ) => {
      _checkImport(node);
    },
    // import foo = ...
    'TSImportEqualsDeclaration > TSExternalModuleReference > Literal': (
      node: any,
    ) => {
      _checkImport(node);
    },
    // export ?? from 'module'
    ExportAllDeclaration: (node: any) => {
      _checkImport((<TSESTree.ExportAllDeclaration>node).source);
    },
    // export {foo} from 'module'
    ExportNamedDeclaration: (node: any) => {
      _checkImport((<TSESTree.ExportNamedDeclaration>node).source);
    },
  };
}
