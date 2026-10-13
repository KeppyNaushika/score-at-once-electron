/**
 * 配布物に入るコード（画面 `src/`・main `electron-src/`・web 版 `web/`）が、devDependencies を
 * import していないことを縛る。
 *
 * 同梱するライブラリのライセンスの一覧（`scripts/thirdPartyLicenses.mjs`）は、本番の依存
 * （dependencies とその先）から作る。devDependencies を import して束ねると、配布物に入るのに
 * 一覧に出ない。例外は `DISTRIBUTED_DEV_PACKAGES`（Electron。実行環境そのもの）だけ。
 *
 * 型だけの import（`import type`）は配布物に入らないので数えない。
 */
import * as fs from "node:fs"
import * as path from "node:path"

import ts from "typescript"
import { describe, expect, it } from "vitest"

import { DISTRIBUTED_DEV_PACKAGES } from "../../scripts/thirdPartyLicenses.mjs"

const rootDir = path.resolve(__dirname, "../..")
const BUNDLED_SOURCE_DIRS = ["src", "electron-src", "web"]
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|mjs)$/

const packageJson: { devDependencies: Record<string, string> } = JSON.parse(
  fs.readFileSync(path.join(rootDir, "package.json"), "utf8")
)
const devPackageNames = new Set(
  Object.keys(packageJson.devDependencies).filter(
    (packageName) => !(packageName in DISTRIBUTED_DEV_PACKAGES)
  )
)

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "node_modules" ? [] : listSourceFiles(entryPath)
    }
    return SOURCE_FILE_PATTERN.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [entryPath]
      : []
  })
}

/** `@scope/name/sub` → `@scope/name`、`name/sub` → `name` */
function packageNameOfSpecifier(specifier: string): string {
  const segments = specifier.split("/")
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0]
}

/** 実行時に読まれる import の指定子（型だけのものを除く） */
function runtimeImportSpecifiers(sourceFile: ts.SourceFile): string[] {
  const specifiers: string[] = []
  const visit = (node: ts.Node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      const importClause = node.importClause
      const namedBindings = importClause?.namedBindings
      const isTypeOnly =
        importClause?.isTypeOnly === true ||
        (importClause !== undefined &&
          importClause.name === undefined &&
          namedBindings !== undefined &&
          ts.isNamedImports(namedBindings) &&
          namedBindings.elements.length > 0 &&
          namedBindings.elements.every((element) => element.isTypeOnly))
      if (!isTypeOnly) specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier !== undefined &&
      ts.isStringLiteral(node.moduleSpecifier) &&
      !node.isTypeOnly
    ) {
      specifiers.push(node.moduleSpecifier.text)
    } else if (
      ts.isCallExpression(node) &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0]) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === "require"))
    ) {
      specifiers.push(node.arguments[0].text)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return specifiers
}

describe("配布物に入るコードは devDependencies を import しない", () => {
  it("src・electron-src・web の実行時の import は dependencies だけ", () => {
    const violations = BUNDLED_SOURCE_DIRS.flatMap((dir) =>
      listSourceFiles(path.join(rootDir, dir))
    ).flatMap((filePath) => {
      const sourceFile = ts.createSourceFile(
        filePath,
        fs.readFileSync(filePath, "utf8"),
        ts.ScriptTarget.Latest,
        true
      )
      return runtimeImportSpecifiers(sourceFile)
        .filter((specifier) =>
          devPackageNames.has(packageNameOfSpecifier(specifier))
        )
        .map((specifier) => `${path.relative(rootDir, filePath)}: ${specifier}`)
    })

    expect(violations).toEqual([])
  })
})
