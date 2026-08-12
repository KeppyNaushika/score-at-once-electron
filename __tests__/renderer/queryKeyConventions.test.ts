/**
 * クエリキーの規約をソースの走査で守る。
 *
 * この2つは型検査でもユニットテストでも捕まらない。同じキーに違う形を書いても
 * 型は通り、テストは1画面ずつしか動かさないので衝突が起きない。実際に
 * 「詳細画面が資料を、評価項目画面が項目の配列を、同じキーへ書く」状態が
 * マージ直前まで残った（docs/ipc-and-data-fetching-plan.md 段階7 A）。
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")

interface QueryUsage {
  /** `queryKeys.exam.detail` のようなキーの作り手 */
  keyFactory: string
  /** queryFn が呼ぶ IPC（`window.electronAPI.` の後ろ） */
  ipcCalls: string[]
  location: string
}

/** `queryKeys.a.b` の形をテキストから拾う */
function findKeyFactory(text: string): string | null {
  return /queryKeys(?:\.[A-Za-z0-9_]+)+/.exec(text)?.[0] ?? null
}

/** `window.electronAPI.a.b(` の形をテキストから全て拾う */
function findIpcCalls(text: string): string[] {
  const calls = new Set<string>()
  const pattern = /window\.electronAPI(?:\??\.[A-Za-z0-9_]+)+/g
  for (const match of text.matchAll(pattern)) {
    calls.add(match[0].replace(/\?\./g, "."))
  }
  return [...calls].sort()
}

function collectQueryUsages(): {
  usages: QueryUsage[]
  literalKeys: string[]
} {
  const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")

  const usages: QueryUsage[] = []
  const literalKeys: string[] = []

  for (const relativePath of files) {
    const fullPath = path.join(REPO_ROOT, relativePath)
    const source = ts.createSourceFile(
      fullPath,
      fs.readFileSync(fullPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )

    // ファイル内の `const x = ...` を、キーの参照を辿るために持っておく
    const bindings = new Map<string, string>()
    const collectBindings = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        bindings.set(node.name.text, node.initializer.getText())
      }
      ts.forEachChild(node, collectBindings)
    }
    collectBindings(source)

    const visit = (node: ts.Node) => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "useQuery" &&
        node.arguments.length > 0 &&
        ts.isObjectLiteralExpression(node.arguments[0])
      ) {
        const options = node.arguments[0]
        const propertyText = (name: string): string | null => {
          for (const property of options.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              property.name.getText() === name
            ) {
              return property.initializer.getText()
            }
            if (
              ts.isShorthandPropertyAssignment(property) &&
              property.name.text === name
            ) {
              return bindings.get(name) ?? name
            }
          }
          return null
        }

        const rawKey = propertyText("queryKey")
        const queryFn = propertyText("queryFn")
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        const location = `${relativePath}:${line + 1}`
        if (!rawKey || !queryFn) return

        // 識別子で渡していたら宣言まで1段辿る（`const queryKey = queryKeys...`）
        const keyText = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(rawKey)
          ? (bindings.get(rawKey) ?? rawKey)
          : rawKey

        const keyFactory = findKeyFactory(keyText)
        if (!keyFactory) {
          literalKeys.push(location)
          return
        }
        usages.push({
          keyFactory,
          ipcCalls: findIpcCalls(queryFn),
          location,
        })
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return { usages, literalKeys }
}

describe("クエリキーの規約", () => {
  const { usages, literalKeys } = collectQueryUsages()

  it("走査そのものが機能している（useQuery を見つけられている）", () => {
    expect(usages.length).toBeGreaterThan(30)
  })

  it("キーは queryKeys を経由して作る", () => {
    expect(literalKeys).toEqual([])
  })

  it("同じキーには同じ IPC しか載せない", () => {
    const callsByKey = new Map<string, Map<string, string[]>>()
    for (const usage of usages) {
      const signature = usage.ipcCalls.join(" + ")
      const bySignature = callsByKey.get(usage.keyFactory) ?? new Map()
      bySignature.set(signature, [
        ...(bySignature.get(signature) ?? []),
        usage.location,
      ])
      callsByKey.set(usage.keyFactory, bySignature)
    }

    const conflicts = [...callsByKey.entries()]
      .filter(([, bySignature]) => bySignature.size > 1)
      .map(([keyFactory, bySignature]) => ({
        keyFactory,
        variants: [...bySignature.entries()].map(([signature, locations]) => ({
          ipcCalls: signature,
          locations,
        })),
      }))

    expect(conflicts).toEqual([])
  })
})
