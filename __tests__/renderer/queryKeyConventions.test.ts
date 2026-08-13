/**
 * クエリキーの規約をソースの走査で守る。
 *
 * ここで見ることは型検査でもユニットテストでも捕まらない。同じキーに違う形を
 * 書いても型は通り、テストは1画面ずつしか動かさないので衝突が起きない。実際に
 * 「詳細画面が資料を、評価項目画面が項目の配列を、同じキーへ書く」状態が
 * マージ直前まで残った（docs/ipc-and-data-fetching-plan.md 段階7 A）。
 *
 * 走査は TypeScript の Program を1つ作って行う（型検査器が要る検査があるため）。
 * 数秒かかるが、対象は `src/` の全ファイルで、grep では追えない。
 */

import { execSync } from "child_process"
import * as path from "path"
import ts from "typescript"
import { beforeAll, describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")

/** キーを取るフック。増えたらここへ足す（漏れると検査を素通りする） */
const QUERY_HOOKS = new Set(["useQuery", "useInfiniteQuery"])

/** キャッシュを読む側（`useQuery`） */
interface Reader {
  keyFactory: string
  /** そのキーに入る形。型引数があればそれ、無ければ `queryFn` の戻り値 */
  dataType: ts.Type
  /** queryFn が呼ぶ IPC（`window.electronAPI.` の後ろ） */
  ipcCalls: string[]
  location: string
}

/** キャッシュへ書く側（`setQueryData`） */
interface Writer {
  keyFactory: string
  /** 書き込む形。型引数があればそれ、無ければ渡した値・更新関数の戻り値 */
  dataType: ts.Type
  location: string
}

interface Scan {
  readers: Reader[]
  writers: Writer[]
  /** `queryKeys` を経由せずリテラルのキーを書いている場所 */
  literalKeys: string[]
  checker: ts.TypeChecker
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

/** 更新関数なら戻り値、値ならそのものの型 */
function typeOfWrittenValue(
  checker: ts.TypeChecker,
  node: ts.Expression
): ts.Type {
  const type = checker.getTypeAtLocation(node)
  const signatures = type.getCallSignatures()
  return signatures.length > 0 ? signatures[0].getReturnType() : type
}

/** `queryFn` が最終的に返す形。`skipToken` との union はほどく */
function typeOfQueryResult(
  checker: ts.TypeChecker,
  queryFn: ts.Expression
): ts.Type | null {
  const type = checker.getTypeAtLocation(queryFn)
  for (const constituent of type.isUnion() ? type.types : [type]) {
    const signatures = constituent.getCallSignatures()
    if (signatures.length === 0) continue
    const returned = signatures[0].getReturnType()
    return checker.getAwaitedType(returned) ?? returned
  }
  return null
}

/**
 * 書き込む形が読む側の形に収まるか。
 *
 * 更新関数は未取得のとき `undefined` を返すので、`undefined` の枝は見ない。
 * union は枝ごとに見る（union をその場で組み直す API は公開されていない）。
 */
function fitsInto(
  checker: ts.TypeChecker,
  written: ts.Type,
  read: ts.Type
): boolean {
  const branches = written.isUnion() ? written.types : [written]
  return branches
    .filter((branch) => !(branch.flags & ts.TypeFlags.Undefined))
    .every((branch) => checker.isTypeAssignableTo(branch, read))
}

function scan(): Scan {
  const configPath = path.join(REPO_ROOT, "tsconfig.json")
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, REPO_ROOT)
  const program = ts.createProgram(parsed.fileNames, {
    ...parsed.options,
    noEmit: true,
  })
  const checker = program.getTypeChecker()

  const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx'", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")

  const readers: Reader[] = []
  const writers: Writer[] = []
  const literalKeys: string[] = []

  for (const relativePath of files) {
    const source = program.getSourceFile(path.join(REPO_ROOT, relativePath))
    if (!source) continue

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

    /** 識別子で渡していたら宣言まで1段辿る（`const queryKey = queryKeys...`） */
    const resolveKeyFactory = (text: string): string | null =>
      findKeyFactory(
        /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(text)
          ? (bindings.get(text) ?? text)
          : text
      )

    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart())
        const location = `${relativePath}:${line + 1}`
        const callee = node.expression.getText()

        if (callee.endsWith("setQueryData") && node.arguments.length >= 2) {
          const keyFactory = resolveKeyFactory(node.arguments[0].getText())
          if (keyFactory) {
            const declared = node.typeArguments?.[0]
            writers.push({
              keyFactory,
              dataType: declared
                ? checker.getTypeFromTypeNode(declared)
                : typeOfWrittenValue(checker, node.arguments[1]),
              location,
            })
          } else {
            literalKeys.push(location)
          }
        }

        if (
          ts.isIdentifier(node.expression) &&
          QUERY_HOOKS.has(node.expression.text) &&
          node.arguments.length > 0 &&
          ts.isObjectLiteralExpression(node.arguments[0])
        ) {
          const options = node.arguments[0]
          const property = (name: string): ts.Expression | null => {
            for (const assignment of options.properties) {
              if (
                ts.isPropertyAssignment(assignment) &&
                assignment.name.getText() === name
              ) {
                return assignment.initializer
              }
              if (
                ts.isShorthandPropertyAssignment(assignment) &&
                assignment.name.text === name
              ) {
                return assignment.name
              }
            }
            return null
          }

          const keyNode = property("queryKey")
          const queryFn = property("queryFn")
          if (keyNode && queryFn) {
            const keyFactory = resolveKeyFactory(keyNode.getText())
            if (!keyFactory) {
              literalKeys.push(location)
            } else {
              const declared = node.typeArguments?.[0]
              const dataType = declared
                ? checker.getTypeFromTypeNode(declared)
                : typeOfQueryResult(checker, queryFn)
              if (dataType) {
                readers.push({
                  keyFactory,
                  dataType,
                  ipcCalls: findIpcCalls(queryFn.getText()),
                  location,
                })
              }
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }

  return { readers, writers, literalKeys, checker }
}

describe("クエリキーの規約", () => {
  let scanned: Scan

  beforeAll(() => {
    scanned = scan()
  })

  it("走査そのものが機能している（読み書きを見つけられている）", () => {
    expect(scanned.readers.length).toBeGreaterThan(30)
    expect(scanned.writers.length).toBeGreaterThan(10)
  })

  it("キーは queryKeys を経由して作る", () => {
    expect(scanned.literalKeys).toEqual([])
  })

  it("同じキーには同じ IPC しか載せない", () => {
    const callsByKey = new Map<string, Map<string, string[]>>()
    for (const reader of scanned.readers) {
      const signature = reader.ipcCalls.join(" + ")
      const bySignature = callsByKey.get(reader.keyFactory) ?? new Map()
      bySignature.set(signature, [
        ...(bySignature.get(signature) ?? []),
        reader.location,
      ])
      callsByKey.set(reader.keyFactory, bySignature)
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

  it("書き込む形は、そのキーを読む側の形と一致する", () => {
    const { checker } = scanned
    // 1つのキーを複数の画面が読むことがある。どれから見ても収まることを要求する
    const readersByKey = new Map<string, Reader[]>()
    for (const reader of scanned.readers) {
      readersByKey.set(reader.keyFactory, [
        ...(readersByKey.get(reader.keyFactory) ?? []),
        reader,
      ])
    }

    const mismatches = scanned.writers.flatMap((writer) =>
      (readersByKey.get(writer.keyFactory) ?? [])
        .filter(
          (reader) => !fitsInto(checker, writer.dataType, reader.dataType)
        )
        .map((reader) => ({
          keyFactory: writer.keyFactory,
          write: `${writer.location}: ${checker.typeToString(writer.dataType)}`,
          read: `${reader.location}: ${checker.typeToString(reader.dataType)}`,
        }))
    )

    expect(mismatches).toEqual([])
  })

  it("誰も読まないキーへは書かない", () => {
    const readKeys = new Set(scanned.readers.map((reader) => reader.keyFactory))
    const orphans = scanned.writers
      .filter((writer) => !readKeys.has(writer.keyFactory))
      .map((writer) => `${writer.keyFactory} (${writer.location})`)

    expect(orphans).toEqual([])
  })
})
