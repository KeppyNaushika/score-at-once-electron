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
import * as fs from "fs"
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
  /** 不安定なコールバックを effect の依存へ入れている場所 */
  unstableEffects: string[]
  checker: ts.TypeChecker
}

/**
 * キーの出どころをテキストから拾う。
 *
 * 移行前の `queryKeys.a.b` と、移行後の `xxxQuery(...).queryKey`（`src/queries/`
 * の `queryOptions` が持つキー）の両方を認める。どちらでもないものは、画面側で
 * 組み立てたリテラルのキーとして弾く。
 */
function findKeyFactory(text: string): string | null {
  return (
    /queryKeys(?:\.[A-Za-z0-9_]+)+/.exec(text)?.[0] ??
    /([A-Za-z0-9_$]+Query)\s*\([^()]*\)\s*\.queryKey/.exec(text)?.[1] ??
    null
  )
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
 * `xxxQuery(id)` が返す options から、そのキーに入る形を取り出す。
 *
 * `queryOptions` の戻り値は options そのものなので、そのままでは「キーに入る形」に
 * ならない。`queryFn` の戻り値まで降りて初めて、`setQueryData` が書く形と比べられる。
 */
function typeOfQueryOptions(
  checker: ts.TypeChecker,
  optionsType: ts.Type
): ts.Type | null {
  const queryFn = optionsType.getProperty("queryFn")
  if (!queryFn) return null
  const type = checker.getTypeOfSymbol(queryFn)
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

/**
 * キー配列に依存して不安定になったコールバックの名前を集める。
 *
 * `queryKeys.exam.x(id)` は毎レンダー新しい配列を返す。それを `useCallback` の依存へ
 * 入れるとコールバックが毎レンダー別物になり、そのコールバックに依存する effect の
 * 後始末が**毎レンダー走る**。「アンマウント時だけ」のつもりの処理が壊れる。
 */
function collectUnstableCallbacks(source: ts.SourceFile): Set<string> {
  const keyNames = new Set<string>()
  const unstable = new Set<string>()

  const collectKeys = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const text = node.initializer.getText()
      // useMemo で包んであれば同一性は保たれる
      if (
        /\bqueryKeys(\.[A-Za-z0-9_]+)+/.test(text) &&
        !text.startsWith("useMemo")
      ) {
        keyNames.add(node.name.text)
      }
    }
    ts.forEachChild(node, collectKeys)
  }
  collectKeys(source)

  // 不安定なものに依存するものも不安定。伝播が止まるまで回す
  let grew = true
  while (grew) {
    grew = false
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        ts.isCallExpression(node.initializer) &&
        ts.isIdentifier(node.initializer.expression) &&
        ["useCallback", "useMemo"].includes(node.initializer.expression.text) &&
        node.initializer.arguments.length >= 2 &&
        ts.isArrayLiteralExpression(node.initializer.arguments[1])
      ) {
        const dependsOnUnstable = node.initializer.arguments[1].elements.some(
          (dep) => {
            const name = dep.getText()
            return (
              keyNames.has(name) ||
              unstable.has(name) ||
              /^queryKeys(\.[A-Za-z0-9_]+)+\(/.test(name)
            )
          }
        )
        if (dependsOnUnstable && !unstable.has(node.name.text)) {
          unstable.add(node.name.text)
          grew = true
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return unstable
}

/**
 * `src/queries/**` に置いた取得の定義を読む。
 *
 * 新しい形は `useQuery(gradeItemExclusionsQuery(gradeId))` のように、キーも `queryFn` も
 * 定義側にある。呼び出し側だけを見ると**何も見つからない**ので、先に定義を読んで
 * 関数名から引けるようにしておく（見落とすと、移行が進むほど検査が空洞化する）。
 */
function collectQueryDefinitions(): Map<
  string,
  { key: string; ipcCalls: string[] }
> {
  const definitions = new Map<string, { key: string; ipcCalls: string[] }>()
  const files = execSync(
    "git ls-files --cached --others --exclude-standard src/queries/",
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }
  )
    .trim()
    .split("\n")
    .filter(Boolean)

  for (const relativePath of files) {
    const fullPath = path.join(REPO_ROOT, relativePath)
    if (!fs.existsSync(fullPath)) continue
    const source = ts.createSourceFile(
      fullPath,
      fs.readFileSync(fullPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )
    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer
      ) {
        const text = node.initializer.getText()
        // 無限スクロールも取得の定義（`infiniteQueryOptions`）。取りこぼすと
        // 呼び出し側が「リテラルのキー」に見えて誤検知になる
        const isQuery = /\b(?:queryOptions|infiniteQueryOptions)\(/.test(text)
        if (isQuery) {
          const key = /queryKey:\s*([^\n]+)/.exec(text)?.[1]?.trim() ?? ""
          definitions.set(node.name.text, {
            key,
            ipcCalls: findIpcCalls(text),
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return definitions
}

/**
 * 取得は境界の返り値をそのまま返す。
 *
 * `src/queries/**` の `queryOptions` が、`window.electronAPI.*` の呼び出し1本を
 * そのまま返しているかを見る。組み立てた値（複数の呼び出しを束ねたオブジェクト・
 * Set・並べ替えた配列）を返していたら、それは**取得ではなく計算**で、キャッシュに
 * 載るのは DB の行ではなくなる。
 *
 * 派生物をキャッシュに置くと、1レコードの書き込みに対して取り直す先が「派生物」に
 * なり、束ごと作り直すか手で書き換えるか（＝楽観更新）の二択になる。実際に
 * `useCourseworkScores` がその形をしていた。
 *
 * @returns 違反の場所（`ファイル:定義名`）
 */
function findAssembledQueryFns(): string[] {
  const violations: string[] = []
  const files = execSync(
    "git ls-files --cached --others --exclude-standard src/queries/",
    { cwd: REPO_ROOT, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)

  /** `window.electronAPI.…(…)` の呼び出しか */
  const isBoundaryCall = (node: ts.Node): boolean =>
    ts.isCallExpression(node) &&
    node.expression.getText().startsWith("window.electronAPI.")

  for (const relativePath of files) {
    const fullPath = path.join(REPO_ROOT, relativePath)
    if (!fs.existsSync(fullPath)) continue
    const source = ts.createSourceFile(
      fullPath,
      fs.readFileSync(fullPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS
    )

    const visit = (node: ts.Node) => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        /\bqueryOptions\(/.test(node.initializer.getText())
      ) {
        const definitionName = node.name.text
        const findQueryFn = (inner: ts.Node): ts.Node | undefined => {
          if (
            ts.isPropertyAssignment(inner) &&
            inner.name.getText() === "queryFn"
          ) {
            return inner.initializer
          }
          return ts.forEachChild(inner, findQueryFn)
        }
        const queryFn = findQueryFn(node.initializer)
        if (queryFn && ts.isArrowFunction(queryFn)) {
          // `() => 呼び出し` か `() => { return 呼び出し }` のどちらも許す
          let returned: ts.Node = queryFn.body
          if (ts.isBlock(returned)) {
            const statements = returned.statements
            const onlyReturn =
              statements.length === 1 && ts.isReturnStatement(statements[0])
                ? statements[0].expression
                : undefined
            if (!onlyReturn) {
              violations.push(`${relativePath}: ${definitionName}`)
              return
            }
            returned = onlyReturn
          }
          if (ts.isAwaitExpression(returned)) returned = returned.expression
          if (!isBoundaryCall(returned)) {
            violations.push(`${relativePath}: ${definitionName}`)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return violations
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

  const files = execSync(
    "git ls-files --cached --others --exclude-standard 'src/**/*.ts' 'src/**/*.tsx'",
    {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }
  )
    .trim()
    .split("\n")

  const readers: Reader[] = []
  const writers: Writer[] = []
  const literalKeys: string[] = []
  const unstableEffects: string[] = []
  const queryDefinitions = collectQueryDefinitions()

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

    const unstableCallbacks = collectUnstableCallbacks(source)

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

        if (
          (callee === "useEffect" || callee === "useLayoutEffect") &&
          node.arguments.length >= 2 &&
          ts.isArrayLiteralExpression(node.arguments[1])
        ) {
          for (const dep of node.arguments[1].elements) {
            if (unstableCallbacks.has(dep.getText())) {
              unstableEffects.push(`${location}: ${dep.getText()}`)
            }
          }
        }

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

        // 新しい形: useQuery(xxxQuery(id)) — キーと queryFn は定義側にある
        if (
          ts.isIdentifier(node.expression) &&
          QUERY_HOOKS.has(node.expression.text) &&
          node.arguments.length > 0 &&
          ts.isCallExpression(node.arguments[0]) &&
          ts.isIdentifier(node.arguments[0].expression)
        ) {
          const definitionName = node.arguments[0].expression.text
          const definition = queryDefinitions.get(definitionName)
          if (definition) {
            const optionsType = checker.getTypeAtLocation(node.arguments[0])
            readers.push({
              keyFactory: definitionName,
              dataType: typeOfQueryOptions(checker, optionsType) ?? optionsType,
              ipcCalls: definition.ipcCalls,
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

  return { readers, writers, literalKeys, unstableEffects, checker }
}

/**
 * 既知の未修正。**増やさないこと。**
 *
 * 段階12 で 08-export のデバウンスごと消えたので、今は空。
 */
const KNOWN_UNSTABLE_EFFECTS: string[] = []

describe("クエリキーの規約", () => {
  let scanned: Scan

  beforeAll(() => {
    scanned = scan()
  })

  it("走査そのものが機能している（読みを見つけられている）", () => {
    expect(scanned.readers.length).toBeGreaterThan(30)
  })

  // 書く側（`setQueryData`）の件数は下限を置かない。**楽観更新は既定で書かない**
  // 規約（coding-style.md）に従って減っていく一方で、いずれ 0 になるため。
  // 走査が機能しているかは読み側の下限で見る

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

  it("キー配列に依存するコールバックを effect の依存へ入れない", () => {
    const unexpected = scanned.unstableEffects.filter(
      (location) => !KNOWN_UNSTABLE_EFFECTS.includes(location)
    )

    expect(unexpected).toEqual([])
  })

  it("取得は境界の返り値をそのまま返す（組み立てた値を載せない）", () => {
    expect(findAssembledQueryFns()).toEqual([])
  })

  it("誰も読まないキーへは書かない", () => {
    const readKeys = new Set(scanned.readers.map((reader) => reader.keyFactory))
    const orphans = scanned.writers
      .filter((writer) => !readKeys.has(writer.keyFactory))
      .map((writer) => `${writer.keyFactory} (${writer.location})`)

    expect(orphans).toEqual([])
  })
})
