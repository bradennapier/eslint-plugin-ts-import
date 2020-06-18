// import path from 'path';
// eslint-disable-next-line import/no-extraneous-dependencies
import { ImportPathsResolver } from '@zerollup/ts-helpers';
import ts from 'typescript';

export interface Config {
  /**
    Disable plugin path resolving for given paths keys
    @default undefined
  */
  exclude?: string[] | undefined;

  /**
   * Disable path rewriting for generated d.ts
   *
   * @default false
   */
  disableForDeclarations?: boolean;

  /**
   * Try to load min.js and .js versions of each mapped import: for use ts without bundler
   * @default false
   */
  tryLoadJs?: boolean;
}

export const defaultConfig: Config = {};

type FileExists = Partial<Pick<ts.ModuleResolutionHost, 'fileExists'>>;

export type EmitHost = FileExists;

export type Program = ts.Program & FileExists;

export type TransformationContext = ts.TransformationContext & {
  getEmitHost?: () => EmitHost;
};

type ExtractElement<T> = T extends Array<unknown> ? T[number] : T;

export type CustomTransformer = {
  [Key in keyof ts.CustomTransformers]: ExtractElement<
    ts.CustomTransformers[Key]
  >;
};

const fileExistsParts = ['.min.js', '.js'] as const;

const tsParts = [
  '.ts',
  '.d.ts',
  '.tsx',
  '/index.ts',
  '/index.tsx',
  '/index.d.ts',
  '',
] as const;

export class ImportPathInternalResolver {
  protected resolver: ImportPathsResolver;

  protected emitHost: EmitHost | undefined;

  constructor(protected program: Program, protected config: Config = {}) {
    const { paths, baseUrl } = program.getCompilerOptions();
    this.resolver = new ImportPathsResolver({
      paths,
      baseUrl,
      exclude: config.exclude,
    });
    // this.emitHost = program.getEmitHost
    //   ? program.getEmitHost()
    //   : undefined;
  }

  fileExists(file: string) {
    const { program, emitHost } = this;
    if (program?.fileExists) {
      return program.fileExists(file);
    }
    if (emitHost?.fileExists) {
      return emitHost.fileExists(file);
    }

    return true;
  }

  resolveImport(oldImport: string, currentDir: string): string | undefined {
    const { config } = this;
    const newImports = this.resolver.getImportSuggestions(
      oldImport,
      currentDir,
    );

    if (!newImports) {
      return;
    }

    for (const newImport of newImports) {
      for (const part of tsParts) {
        if (this.fileExists(`${newImport}${part}`)) {
          return newImport;
        }
      }

      if (config.tryLoadJs) {
        for (const ext of fileExistsParts) {
          if (this.fileExists(`${newImport}${ext}`)) {
            return `${newImport}${ext}`;
          }
        }
      }
    }
  }
}
