import { readdir, readFile } from 'node:fs/promises';
import { basename, extname, join, relative } from 'node:path';
import ts from 'typescript';

export interface NoZodDiagnostic {
  readonly file: string;
  readonly line: number;
  readonly message: string;
}
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const excludedDirectories = new Set([
  'node_modules',
  'dist',
  'build',
  'public',
  '.git',
  '.cache',
  'coverage',
]);
const dependencyGroups = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

/** Finds maintained source and manifests without following generated or dependency trees. */
async function policyFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !excludedDirectories.has(entry.name))
      result.push(...(await policyFiles(path)));
    if (
      entry.isFile() &&
      (entry.name === 'package.json' || sourceExtensions.has(extname(entry.name)))
    )
      result.push(path);
  }
  return result;
}

/** Reads static module strings, including non-interpolated template literals. */
function moduleString(node: ts.Node | undefined): string | undefined {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** Identifies dynamic imports and CommonJS requires without matching ordinary string literals. */
function calledModule(node: ts.CallExpression): string | undefined {
  const expression = node.expression;
  const isImport = expression.kind === ts.SyntaxKind.ImportKeyword;
  const isRequire = ts.isIdentifier(expression) && expression.text === 'require';
  return isImport || isRequire ? moduleString(node.arguments[0]) : undefined;
}

/** Identifies static imports, re-exports, and CommonJS import assignments. */
function importedModule(node: ts.Node): string | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    return moduleString(node.moduleSpecifier);
  if (ts.isCallExpression(node)) return calledModule(node);
  if (ts.isImportTypeNode(node)) {
    return ts.isLiteralTypeNode(node.argument) ? moduleString(node.argument.literal) : undefined;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return moduleString(node.moduleReference.expression);
  }
  return undefined;
}

/** Reports direct Zod imports without rejecting comments, documentation, or test fixture strings. */
export function sourceDiagnostics(file: string, source: string): NoZodDiagnostic[] {
  const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const diagnostics: NoZodDiagnostic[] = [];
  const visit = (node: ts.Node): void => {
    const name = importedModule(node);
    if (name === 'zod' || name?.startsWith('zod/')) {
      diagnostics.push({
        file,
        line: parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1,
        message: `direct import of ${name}; use shared pi-schema validation`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return diagnostics;
}

/** Reports direct application dependencies while leaving upstream transitive dependencies untouched. */
export function manifestDiagnostics(file: string, source: string): NoZodDiagnostic[] {
  const manifest: unknown = JSON.parse(source);
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest))
    throw new Error(`Invalid package manifest: ${file}`);
  return dependencyGroups.flatMap((group) => {
    const dependencies: unknown = Reflect.get(manifest, group);
    if (typeof dependencies !== 'object' || dependencies === null) return [];
    return Object.entries(dependencies)
      .filter(
        ([name, version]) =>
          name === 'zod' || (typeof version === 'string' && /^npm:zod(?:@|$)/.test(version)),
      )
      .map(([name]) => ({ file, line: 1, message: `direct Zod dependency in ${group}: ${name}` }));
  });
}

/** Audits root, package, and script code; excludes lockfile-only transitive dependencies. */
export async function auditNoZod(root: string): Promise<NoZodDiagnostic[]> {
  const files = [
    join(root, 'package.json'),
    ...(await policyFiles(join(root, 'packages'))),
    ...(await policyFiles(join(root, 'scripts'))),
  ];
  const diagnostics: NoZodDiagnostic[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const displayPath = relative(root, file);
    diagnostics.push(
      ...(basename(file) === 'package.json'
        ? manifestDiagnostics(displayPath, source)
        : sourceDiagnostics(displayPath, source)),
    );
  }
  return diagnostics;
}
