import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export function checkPluginBoundaries(root = path.resolve('src/app'), compilerOptions = {}) {
  const errors = [];
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (file.endsWith('.ts')) files.push(file);
    }
  }
  walk(root);
  const parts = (file) => path.relative(root, file).split(path.sep);
  const domain = (file) => parts(file)[0] === 'plugins' ? parts(file)[1] : undefined;
  for (const file of files) {
    const relative = path.relative(root, file);
    const sourceLayer = parts(file)[0];
    const isSpec = file.endsWith('.spec.ts');
    const ast = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)
      ) specifier = node.moduleSpecifier.text;
      if (
        ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])
      ) specifier = node.arguments[0].text;
      if (
        ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) &&
        ts.isStringLiteral(node.argument.literal)
      ) specifier = node.argument.literal.text;
      if (specifier) {
        const resolved = ts.resolveModuleName(specifier, file, compilerOptions, ts.sys).resolvedModule;
        const target = resolved?.resolvedFileName ??
          (specifier.startsWith('.') ? path.resolve(path.dirname(file), specifier) : undefined);
        if (target) {
          const targetLayer = parts(target)[0];
          const targetDomain = domain(target);
          if (targetDomain && domain(file) !== targetDomain && sourceLayer !== 'composition') {
            errors.push(`${relative}: implementation dependency on plug-in ${targetDomain} (${specifier})`);
          }
          if (domain(file) && !['plugins', 'core', 'plugin-sdk', '..'].includes(targetLayer)) {
            errors.push(`${relative}: plug-in dependency outside Core/SDK (${specifier})`);
          }
          if (
            ['core', 'plugin-sdk'].includes(sourceLayer) &&
            (targetLayer === 'features' || (targetLayer === 'composition' && !isSpec))
          ) {
            errors.push(`${relative}: ${sourceLayer} dependency on ${targetLayer} (${specifier})`);
          }
        }
      }
      // Test fixtures may contain concrete node types; their imports still obey the boundaries.
      if (!isSpec && !domain(file) && sourceLayer !== 'composition') {
        if (
          ts.isBinaryExpression(node) &&
          [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
            ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken]
            .includes(node.operatorToken.kind) &&
          [node.left, node.right].some(
            (n) => ts.isPropertyAccessExpression(n) && n.name.text === 'nodeType',
          )
        ) errors.push(`${relative}: concrete node-type branch: ${node.getText(ast)}`);
        if (ts.isSwitchStatement(node) && /nodeType/.test(node.expression.getText(ast)))
          errors.push(`${relative}: node-type switch`);
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  return { errors, fileCount: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, 'tsconfig.app.json');
  const config = configPath ? ts.readConfigFile(configPath, ts.sys.readFile) : undefined;
  const options = configPath && config
    ? ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options : {};
  const { errors, fileCount } = checkPluginBoundaries(path.resolve('src/app'), options);
  if (errors.length) {
    process.stderr.write(errors.join('\n') + '\n');
    process.exitCode = 1;
  } else {
    process.stdout.write(`Plug-in boundaries verified across ${fileCount} TypeScript files (including specs).\n`);
  }
}
