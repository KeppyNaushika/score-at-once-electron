/**
 * IPC 境界の規約をソースの走査で守る。
 *
 * 型検査が見てくれる部分と、見てくれない部分がある。
 *
 * - `invoke<Channel extends keyof Handlers>` のおかげで、**登録の無いチャンネルを
 *   呼ぶ**のはコンパイルエラーになる。ここでの検査は綴りを一覧で見せるためのもの
 * - 逆向き（**登録したまま誰も呼ばないチャンネル**）は型では止まらない。放っておくと
 *   到達不能なハンドラが残る（実例は docs/type-assertion-audit.md §13）
 * - `src/` から `electron-src/` への**値** import も型では止まらない。値で引くと
 *   renderer のバンドルへ main の依存グラフ（Prisma・ネイティブモジュール）が
 *   入り込む
 *
 * Decimal の走査は置かない。境界（`registerChannel`）が戻り値へ一律に
 * `serializePrisma` を掛け、preload の `invoke` が型に `Serialized<>` を掛けるので、
 * ハンドラ個別の書き忘れという状態が作れない。
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")

/**
 * `src/` が値として引いてよい main のモジュールと名前。
 *
 * ここは「純粋計算なら良い」といった判断基準ではなく**名指しの一覧**である。
 * 増やすときは OWNER の判断を通す。いずれも DB もファイルも触らない計算で、
 * main と renderer が同じ結果を出す必要があるもの。
 */
const ALLOWED_VALUE_IMPORTS: Record<string, string[]> = {
  "@/electron-src/lib/shared/utilities/examPaperSize": ["resolveExamPaperSize"],
  "@/electron-src/lib/export/individual-report/types": [
    "STATISTIC_KINDS",
    "STATISTIC_SCOPES",
    "DEFAULT_INDIVIDUAL_REPORT_OPTIONS",
  ],
  "@/electron-src/lib/shared/calculations/numericStats": [
    "calculateAverage",
    "calculateBoxPlot",
    "calculateRank",
    "calculateStandardDeviation",
  ],
  "@/electron-src/lib/shared/calculations/itemAnalysis": [
    "computeItemAnalysis",
  ],
  "@/electron-src/lib/shared/calculations/spAnalysis": [
    "computeFrequencyDistribution",
    "computeSpTable",
  ],
  "@/electron-src/lib/shared/calculations/gradeDataSourceMaxScore": [
    "computeMaxScoreFromPayload",
  ],
}

/**
 * 追跡されているファイルを列挙する。
 *
 * `git ls-files` は**消したがまだ index に残っているファイルも返す**ので、
 * 実在するものだけに絞る（絞らないと、ファイルを消した瞬間にこの検査が
 * 「読み込めない」で落ちる）。
 */
function listFiles(pattern: string): string[] {
  return execSync(`git ls-files ${pattern}`, {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((relativePath) => fs.existsSync(path.join(REPO_ROOT, relativePath)))
}

function parseFile(relativePath: string, kind: ts.ScriptKind): ts.SourceFile {
  const fullPath = path.join(REPO_ROOT, relativePath)
  return ts.createSourceFile(
    fullPath,
    fs.readFileSync(fullPath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    kind
  )
}

/** 登録簿に載っているチャンネル名 → 定義しているファイル */
function collectRegisteredChannels(): Map<string, string> {
  const registered = new Map<string, string>()

  for (const relativePath of listFiles(
    "'electron-src/ipc-handlers/*Handlers.ts'"
  )) {
    const source = parseFile(relativePath, ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.initializer &&
        node.name.getText().endsWith("Handlers")
      ) {
        // `satisfies HandlerMap` / `as const` を剥がす
        let initializer: ts.Node = node.initializer
        while (
          ts.isSatisfiesExpression(initializer) ||
          ts.isAsExpression(initializer)
        ) {
          initializer = initializer.expression
        }
        if (ts.isObjectLiteralExpression(initializer)) {
          for (const property of initializer.properties) {
            const name = property.name
            if (!name) continue
            if (ts.isStringLiteral(name) || ts.isIdentifier(name)) {
              registered.set(name.text, relativePath)
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return registered
}

/** preload が `bind("…")` / `invoke("…")` で呼んでいるチャンネル名 */
function collectInvokedChannels(): Set<string> {
  const invoked = new Set<string>()

  for (const relativePath of listFiles("'electron-src/preload-apis/*.ts'")) {
    const source = parseFile(relativePath, ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === "bind" ||
          node.expression.text === "invoke") &&
        node.arguments.length > 0 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        invoked.add(node.arguments[0].text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return invoked
}

/** `src/` から `electron-src/` を値として引いている箇所 */
function collectValueImports(): string[] {
  const found: string[] = []

  for (const relativePath of listFiles("'src/**/*.ts' 'src/**/*.tsx'")) {
    const source = parseFile(relativePath, ts.ScriptKind.TSX)
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement)) continue
      if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
      const specifier = statement.moduleSpecifier.text
      if (!specifier.startsWith("@/electron-src/")) continue

      const clause = statement.importClause
      if (!clause || clause.isTypeOnly) continue

      const { line } = source.getLineAndCharacterOfPosition(
        statement.getStart()
      )
      const location = `${relativePath}:${line + 1}`
      const allowed = ALLOWED_VALUE_IMPORTS[specifier] ?? []

      const bindings = clause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue
          const imported = element.propertyName?.text ?? element.name.text
          if (!allowed.includes(imported)) {
            found.push(`${location}: ${imported} from ${specifier}`)
          }
        }
      } else {
        // default / namespace import は一覧で表せないので常に違反
        found.push(`${location}: default or namespace from ${specifier}`)
      }
    }
  }

  return found
}

describe("IPC 境界の規約", () => {
  const registered = collectRegisteredChannels()
  const invoked = collectInvokedChannels()

  it("走査そのものが機能している（チャンネルを見つけられている）", () => {
    expect(registered.size).toBeGreaterThan(200)
    expect(invoked.size).toBeGreaterThan(200)
  })

  it("登録したチャンネルは preload から呼ばれている", () => {
    const dead = [...registered.entries()]
      .filter(([channel]) => !invoked.has(channel))
      .map(([channel, file]) => `${channel} (${file})`)

    expect(dead).toEqual([])
  })

  it("preload の呼び出しは全て登録されている", () => {
    const missing = [...invoked].filter((channel) => !registered.has(channel))

    expect(missing).toEqual([])
  })

  it("src から electron-src を値で引くのは名指しの一覧だけ", () => {
    expect(collectValueImports()).toEqual([])
  })
})
