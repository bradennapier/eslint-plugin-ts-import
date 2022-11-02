// Copyright 2021 Alex Gorbatchev <alex.gorbatchev@gmail.com>
// Some code provided has been borrowed from eslint-import-resolver-typescript https://github.com/import-js/eslint-import-resolver-typescript

/* eslint-disable no-nested-ternary */
import path from 'path';

import {
  ConfigLoaderSuccessResult,
  createMatchPath,
  loadConfig,
  ConfigLoaderResult,
} from 'tsconfig-paths';
import { sync as globSync } from 'fast-glob';
import isGlob from 'is-glob';
import { isCore, sync } from 'resolve';
import debug from 'debug';

const log = debug('eslint-plugin-ts-import');

const extensions = ['.ts', '.tsx', '.d.ts'].concat(
  Object.keys(require.extensions),
  '.jsx',
);

export const interfaceVersion = 2;

export interface TsResolverOptions {
  alwaysTryTypes?: boolean;
  directory?: string | string[];
}

/**
 * @param {string} source the module to resolve; i.e './some-module'
 * @param {string} file the importing file's full path; i.e. '/usr/local/bin/file.js'
 */
export function resolve(
  source: string,
  file: string,
  options: TsResolverOptions | null,
): {
  found: boolean;
  core?: boolean;
  path?: string | null;
} {
  // eslint-disable-next-line no-param-reassign
  options = options || {};

  log('looking for:', source);

  // don't worry about core node modules
  if (isCore(source)) {
    log('matched core:', source);

    return {
      found: true,
      core: true,
      path: source,
    };
  }

  initMappers(options);
  const mappedPath = getMappedPath(source, file);
  if (mappedPath) {
    log('matched ts path:', mappedPath);
  }

  // note that even if we map the path, we still need to do a final resolve
  let foundNodePath: string | null | undefined;
  try {
    foundNodePath = sync(mappedPath || source, {
      extensions,
      basedir: path.dirname(path.resolve(file)),
      packageFilter,
    });
  } catch (err) {
    foundNodePath = null;
  }

  // naive attempt at @types/* resolution,
  // if path is neither absolute nor relative
  if (
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    (/\.jsx?$/.test(foundNodePath!) ||
      (options.alwaysTryTypes && !foundNodePath)) &&
    !/^@types[/\\]/.test(source) &&
    !path.isAbsolute(source) &&
    !source.startsWith('.')
  ) {
    const definitelyTyped = resolve(
      `@types${path.sep}${mangleScopedPackage(source)}`,
      file,
      options,
    );
    if (definitelyTyped.found) {
      return definitelyTyped;
    }
  }

  if (foundNodePath) {
    log('matched node path:', foundNodePath);

    return {
      found: true,
      path: foundNodePath,
    };
  }

  log("didn't find ", source);

  return {
    found: false,
  };
}

function packageFilter(pkg: Record<string, string>) {
  // eslint-disable-next-line no-param-reassign
  pkg.main =
    pkg.types || pkg.typings || pkg.module || pkg['jsnext:main'] || pkg.main;
  return pkg;
}

let mappersBuildForOptions: TsResolverOptions;
let mappers:
  | Array<(source: string, file: string) => string | undefined>
  | undefined;

/**
 * @param {string} source the module to resolve; i.e './some-module'
 * @param {string} file the importing file's full path; i.e. '/usr/local/bin/file.js'
 * @returns The mapped path of the module or undefined
 */
function getMappedPath(source: string, file: string) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const paths = mappers!
    .map((mapper) => mapper(source, file))
    .filter((filePath) => !!filePath);

  if (paths.length > 1) {
    log('found multiple matching ts paths:', paths);
  }

  return paths[0];
}

function initMappers(options: TsResolverOptions) {
  if (mappers && mappersBuildForOptions === options) {
    return;
  }

  const isArrayOfStrings = (array?: string | string[]) =>
    Array.isArray(array) && array.every((o) => typeof o === 'string');

  const configPaths =
    typeof options.directory === 'string'
      ? [options.directory]
      : isArrayOfStrings(options.directory)
      ? options.directory
      : [process.cwd()];

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  mappers = configPaths!
    // turn glob patterns into paths
    .reduce<string[]>(
      (paths, fpath) => paths.concat(isGlob(fpath) ? globSync(fpath) : fpath),
      [],
    )
    .map(loadConfig)
    .filter(isConfigLoaderSuccessResult)
    .map((configLoaderResult) => {
      const matchPath = createMatchPath(
        configLoaderResult.absoluteBaseUrl,
        configLoaderResult.paths,
      );

      return (source: string, file: string) => {
        // exclude files that are not part of the config base url
        if (!file.includes(configLoaderResult.absoluteBaseUrl)) {
          return undefined;
        }

        // look for files based on setup tsconfig "paths"
        return matchPath(source, undefined, undefined, extensions);
      };
    });

  mappersBuildForOptions = options;
}

function isConfigLoaderSuccessResult(
  configLoaderResult: ConfigLoaderResult,
): configLoaderResult is ConfigLoaderSuccessResult {
  if (configLoaderResult.resultType !== 'success') {
    // this can happen if the user has problems with their tsconfig
    // or if it's valid, but they don't have baseUrl set
    log('failed to init tsconfig-paths:', configLoaderResult.message);
    return false;
  }
  return true;
}

/**
 * For a scoped package, we must look in `@types/foo__bar` instead of `@types/@foo/bar`.
 */
function mangleScopedPackage(moduleName: string) {
  if (moduleName.startsWith('@')) {
    const replaceSlash = moduleName.replace(path.sep, '__');
    if (replaceSlash !== moduleName) {
      return replaceSlash.slice(1); // Take off the "@"
    }
  }
  return moduleName;
}
