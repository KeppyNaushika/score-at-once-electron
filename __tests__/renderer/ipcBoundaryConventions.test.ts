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
 *   入り込む。**例外は無い**（両側が同じ結果を出す必要のある計算は、段階14 で
 *   `src/lib/shared/` と `src/types/` へ出した）
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
 * 追跡されているファイルを列挙する。
 *
 * `git ls-files` は**消したがまだ index に残っているファイルも返す**ので、
 * 実在するものだけに絞る（絞らないと、ファイルを消した瞬間にこの検査が
 * 「読み込めない」で落ちる）。
 */
function listFiles(pattern: string): string[] {
  return execSync(
    `git ls-files --cached --others --exclude-standard ${pattern}`,
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }
  )
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

/**
 * preload が renderer へ差し出しているメソッド名 → 定義しているファイル。
 *
 * 葉（`bind("…")` や関数）だけを数える。入れ子の名前空間（`audit: { … }`）は
 * それ自体では呼べないので数えない。
 */
function collectPreloadMethods(): Map<string, string> {
  const methods = new Map<string, string>()

  for (const relativePath of listFiles("'electron-src/preload-apis/*.ts'")) {
    if (relativePath.endsWith("invoke.ts")) continue
    const source = parseFile(relativePath, ts.ScriptKind.TS)
    const visit = (node: ts.Node) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        !ts.isObjectLiteralExpression(node.initializer)
      ) {
        methods.set(node.name.text, relativePath)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return methods
}

/** `src/` の中で `.なにか` として触れられている名前 */
function collectPropertyAccesses(): Set<string> {
  const accessed = new Set<string>()

  for (const relativePath of listFiles("'src/**/*.ts' 'src/**/*.tsx'")) {
    // 型宣言は「宣言しているだけ」で呼び出しではない。数えると全部生きて見える
    if (relativePath.endsWith(".d.ts")) continue
    const source = parseFile(relativePath, ts.ScriptKind.TSX)
    const visit = (node: ts.Node) => {
      if (ts.isPropertyAccessExpression(node)) {
        accessed.add(node.name.text)
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return accessed
}

/**
 * 呼ばれていないが残しておく preload メソッド（名指し）。
 *
 * 「使う予定がある」で残すのはここに書いたものだけ。判断基準は書かない。
 */
const UNCALLED_PRELOAD_METHODS = new Set([
  // 監査ログのスコープ絞り込み（#1102）。UI がまだ無い。
  // docs/audit-log-redesign.md「フィルタ次元」の対象（scopeId）で使う
  "getScopes",
])

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

      const bindings = clause.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (element.isTypeOnly) continue
          const imported = element.propertyName?.text ?? element.name.text
          found.push(`${location}: ${imported} from ${specifier}`)
        }
      } else {
        // default / namespace import は一覧で表せないので常に違反
        found.push(`${location}: default or namespace from ${specifier}`)
      }
    }
  }

  return found
}

/**
 * `window.electronAPI` に触れてよい、移行対象でないファイル。
 *
 * 判断基準ではなく**名指しの一覧**である。増やすときは OWNER の判断を通す。
 */
const NOT_A_CALL_SITE = [
  // `window.electronAPI` そのものの宣言。呼び出しではない
  "src/types/electron.d.ts",
]

/**
 * まだ `src/queries/` へ移していないファイル。**空である。**
 *
 * DB へのアクセスは `src/queries/` の `queryOptions` / `defineMutation` に集める。
 * キーと呼び出しが1箇所で結びつくので、同じデータが別のキーで2度キャッシュされる
 * 事故（段階7・段階9 で実際に起きた）が構造的に起きなくなる。
 *
 * 段階14 で移行が終わり、この一覧は空になった。**足さないこと。**
 */
const NOT_YET_MIGRATED: string[] = []

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

  it("preload のメソッドは renderer から呼ばれている（残りは名指しの一覧）", () => {
    // チャンネルが preload から呼ばれていても、その preload メソッドを誰も
    // 呼んでいなければ、ハンドラごと死んでいる。**型では捕まらない**
    // （`src/types/electron/*.d.ts` は宣言しているだけで呼び出しではない）
    const methods = collectPreloadMethods()
    const accessed = collectPropertyAccesses()
    expect(methods.size).toBeGreaterThan(200)

    const uncalled = [...methods.entries()]
      .filter(([name]) => !accessed.has(name))
      .filter(([name]) => !UNCALLED_PRELOAD_METHODS.has(name))
      .map(([name, file]) => `${name} (${file})`)

    expect(uncalled).toEqual([])
  })

  it("src から electron-src を値で引かない（例外なし）", () => {
    expect(collectValueImports()).toEqual([])
  })

  it("DB へのアクセスは src/queries/ に集める（残りは名指しの一覧）", () => {
    const touching = listFiles("src/")
      .filter((relativePath) => /\.tsx?$/.test(relativePath))
      .filter((relativePath) => !relativePath.startsWith("src/queries/"))
      .filter((relativePath) =>
        fs
          .readFileSync(path.join(REPO_ROOT, relativePath), "utf8")
          .includes("window.electronAPI")
      )

    const added = touching.filter(
      (relativePath) =>
        !NOT_YET_MIGRATED.includes(relativePath) &&
        !NOT_A_CALL_SITE.includes(relativePath)
    )
    expect(added).toEqual([])
  })
})
