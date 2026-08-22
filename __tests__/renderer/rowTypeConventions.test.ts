/**
 * DB の行の型は Prisma から導く、をソースの走査で守る。
 *
 * ここで見ることは型検査では捕まらない。手で書き写した型は、それ自体としては
 * 正しい TypeScript なので、**列が増減しても・写し違えても `tsc` は黙っている**。
 * 実際に「一括更新のラッパーが `GradeDataSource` の行を全 optional で手写ししていた」
 * ために、呼ぶ側が `{ id, data }` を渡していても検査を素通りし、機能が丸ごと動いて
 * いなかった（docs/branch-review-findings.md #3）。
 *
 * 規約（CLAUDE.md / docs/coding-style.md §型管理の方針）:
 * DB 由来のデータの型は Prisma 型から導出する。手で書き写さない。表示のために
 * 小さくする `Pick` の独自 view も作らない（`include` の出力はそのまま持つ）。
 *
 * ## 何を見るか
 *
 * `src/` と `electron-src/` の**名前の付いたオブジェクト型の宣言**
 * （`interface X { … }` / `type X = { … }`）のうち、
 *
 * 1. `id: string` を持ち、他にもプロパティがある
 * 2. プロパティ名の集合が、**ただ1つの** Prisma モデルの列・リレーション名に収まる
 *
 * ものを「行の手写し」とみなす。判定はプロパティ名だけで行う（型は見ない）。
 *
 * ## 何を見ていないか（死角。承知のうえで空けてある）
 *
 * - **`id` を持たない手写し。** 書き込みの引数型（`{ examId, classroomId, … }`）に
 *   多いが、列名の集合だけでは「行の写し」と「たまたま同じ名前を持つ器」を区別
 *   できず、誤検知が実測で 20件を超えた。`id` を要求すると誤検知はほぼ消える
 * - **2つ以上のモデルに当てはまる形。** `{ id, name }` は 12 モデルに当てはまる。
 *   どのモデルの写しなのか機械には決められないので、違反と言い切らない
 * - **ジェネリック制約として使われている型**（`<T extends X>`）。これは「行の写し」
 *   ではなく「呼ぶ側の型をそのまま通すための構造の要求」で、実体は呼ぶ側が持つ
 * - **無名（インライン）の型リテラル。** 関数の引数・返り値に直接書いた
 *   `{ id: string; … }` は拾わない
 * - **`extends` を持つ宣言。** 継いだ先が Prisma 型のこともあり（＝導出済み）、
 *   自前のプロパティだけでは判定できない。継いだ先が手写しなら、その先が引っかかる
 * - **`__tests__`。** フィクスチャは読みやすさのために小さく作ってよい
 */

import { execSync } from "child_process"
import * as fs from "fs"
import * as path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma")

/**
 * 名指しの例外。**判断基準ではなく一覧で管理する**（規約: 例外は名指し）。
 * 増やすときは OWNER の明示指定だけ。
 */
const EXCEPTIONS: { pattern: RegExp; reason: string }[] = [
  {
    pattern: /^src\/types\/\w*[Aa]rchive\.types\.ts$/,
    reason:
      "アーカイブのファイル形式（wire format）。版ごとに凍結された形なので Prisma に追随させてはいけない",
  },
  {
    pattern:
      /^electron-src\/lib\/import\/(transformers|coursework-transformers|grade-transformers)\//,
    reason:
      "旧バージョンのアーカイブの形。上と同じ理由で、現在のスキーマへ追随させてはいけない",
  },
  {
    pattern: /^src\/types\/answerSheetDefinition\.types\.ts$/,
    reason:
      "解答用紙作成（ASB）の定義ツリー。段階24 で実体そのものを RDB へ出すので、いま型だけ直すと二度手間になる",
  },
  {
    pattern: /^src\/components\/answer-sheet-builder\//,
    reason: "同上（段階24 の対象）",
  },
]

/** Prisma のモデル名 → 列・リレーション名の集合 */
function prismaModelFields(): Map<string, Set<string>> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8")
  const models = new Map<string, Set<string>>()
  for (const [, name, body] of schema.matchAll(
    /model\s+(\w+)\s*\{([\s\S]*?)\n\}/g
  )) {
    const fields = new Set<string>()
    for (const line of body.split("\n")) {
      const trimmed = line.trim()
      if (trimmed.startsWith("@@") || trimmed.startsWith("//")) continue
      const field = /^(\w+)\s+\S/.exec(trimmed)
      if (field) fields.add(field[1])
    }
    models.set(name, fields)
  }
  return models
}

/**
 * 走査対象のファイル（git が知っているもの。生成物・依存は入らない）。
 *
 * pathspec の `**` の後ろの `/` は**リテラルの区切りとして少なくとも1階層を要求する**ため、
 * ディレクトリ直下のファイルが落ちる（`electron-src` 直下の `index.ts` / `preload.ts` など
 * 7本が、304ファイル中297ファイルしか拾われない形で外れていた）。
 * 直下ぶんの pathspec を別に並べて拾う（`src` 直下に現状ファイルは無いが、
 * 増えたときに同じ穴が開かないよう同じ形で並べる）。
 */
function sourceFiles(): string[] {
  return (
    execSync(
      "git ls-files --cached --others --exclude-standard 'src/*.ts' 'src/*.tsx' 'src/**/*.ts' 'src/**/*.tsx' 'electron-src/*.ts' 'electron-src/**/*.ts'",
      { cwd: REPO_ROOT, encoding: "utf8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      // 消したファイルは、その削除を stage するまで `--cached` に残り続ける。
      // 走査するのは**いま在るコード**なので、作業ツリーに無いものは外す
      // （外さないと readFileSync が ENOENT で落ち、検査そのものが動かなくなる）
      .filter((relativePath) =>
        fs.existsSync(path.join(REPO_ROOT, relativePath))
      )
  )
}

/** 走査で拾った宣言1件 */
interface DeclaredObjectType {
  name: string
  /** 自前で宣言しているプロパティ名（継承は含めない。`extends` 付きは拾わない） */
  properties: string[]
  location: string
}

/**
 * 名前の付いたオブジェクト型の宣言を拾う。
 *
 * `interface X { … }`（`extends` の無いもの）と `type X = { … }` の2つだけ。
 * `type X = Omit<Y, …>` や `type X = Prisma.…GetPayload<…>` は**導出**なので
 * ここには入らない（＝直した型が検査に引っかからない、が成り立つ）。
 */
function collectDeclarations(source: ts.SourceFile): DeclaredObjectType[] {
  const declarations: DeclaredObjectType[] = []

  const propertyNames = (members: ts.NodeArray<ts.TypeElement>): string[] =>
    members
      .filter(ts.isPropertySignature)
      .map((member) =>
        ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)
          ? member.name.text
          : null
      )
      .filter((name): name is string => name !== null)

  const locationOf = (node: ts.Node): string => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    return `${source.fileName}:${line + 1}`
  }

  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && !node.heritageClauses) {
      declarations.push({
        name: node.name.text,
        properties: propertyNames(node.members),
        location: locationOf(node),
      })
    }
    if (ts.isTypeAliasDeclaration(node) && ts.isTypeLiteralNode(node.type)) {
      declarations.push({
        name: node.name.text,
        properties: propertyNames(node.type.members),
        location: locationOf(node),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return declarations
}

/** ジェネリック制約（`<T extends X>`）として使われている型の名前 */
function collectTypeParameterConstraints(source: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  const visit = (node: ts.Node) => {
    if (ts.isTypeParameterDeclaration(node) && node.constraint) {
      const constraint = node.constraint
      if (
        ts.isTypeReferenceNode(constraint) &&
        ts.isIdentifier(constraint.typeName)
      ) {
        names.add(constraint.typeName.text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return names
}

/** その宣言が写している Prisma モデル（1つに決まらなければ null） */
function matchedModel(
  declaration: DeclaredObjectType,
  models: Map<string, Set<string>>
): string | null {
  const { properties } = declaration
  if (!properties.includes("id")) return null
  if (properties.length < 2) return null
  const matched = [...models]
    .filter(([, fields]) => properties.every((name) => fields.has(name)))
    .map(([model]) => model)
  return matched.length === 1 ? matched[0] : null
}

interface Scan {
  declarations: DeclaredObjectType[]
  constraints: Set<string>
  violations: string[]
}

function scan(): Scan {
  const models = prismaModelFields()
  const parsed = sourceFiles()
    .filter(
      (relativePath) =>
        !EXCEPTIONS.some(({ pattern }) => pattern.test(relativePath))
    )
    .map((relativePath) => {
      const fullPath = path.join(REPO_ROOT, relativePath)
      const source = ts.createSourceFile(
        relativePath,
        fs.readFileSync(fullPath, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        relativePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
      return {
        declarations: collectDeclarations(source),
        constraints: collectTypeParameterConstraints(source),
      }
    })

  const declarations = parsed.flatMap((file) => file.declarations)
  // 制約はファイルをまたいで使われる（宣言は types.ts、制約は utils.ts など）
  const constraints = new Set(parsed.flatMap((file) => [...file.constraints]))

  const violations = declarations
    .filter((declaration) => !constraints.has(declaration.name))
    .flatMap((declaration) => {
      const model = matchedModel(declaration, models)
      return model
        ? [
            `${declaration.location}: ${declaration.name} は ${model} の行の手写し` +
              `（{${declaration.properties.join(", ")}}）`,
          ]
        : []
    })

  return { declarations, constraints, violations }
}

/** 検査そのものが働くかを確かめるための、その場で作る見本 */
function scanSample(text: string): string[] {
  const models = prismaModelFields()
  const source = ts.createSourceFile(
    "sample.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const constraints = collectTypeParameterConstraints(source)
  return collectDeclarations(source)
    .filter((declaration) => !constraints.has(declaration.name))
    .flatMap((declaration) => {
      const model = matchedModel(declaration, models)
      return model ? [`${declaration.name} -> ${model}`] : []
    })
}

describe("DB の行の型は Prisma から導く", () => {
  it("スキーマを読めている", () => {
    const models = prismaModelFields()
    expect(models.size).toBeGreaterThan(50)
    expect(models.get("Student")).toContain("studentNumber")
    expect(models.get("ExamPage")).toContain("pageNumber")
  })

  it("走査そのものが機能している（宣言を見つけられている）", () => {
    // 空振りしている検査は「違反ゼロ」と区別が付かない。宣言の総数で下限を置く
    expect(scan().declarations.length).toBeGreaterThan(300)
  })

  it("手写しを実際に見つけられる（見本で確かめる）", () => {
    const flagged = scanSample(`
      interface StudentRow {
        id: string
        studentNumber: string
        lastName: string
      }
    `)
    expect(flagged).toEqual(["StudentRow -> Student"])
  })

  it("導出した型は見つけない（見本で確かめる）", () => {
    // 直した形（Prisma 型・payload・`Pick`/`Omit` での導出）は素通りする。
    // ここが通らないと、直した瞬間に検査が壊れる
    const flagged = scanSample(`
      type StudentRow = Student
      type StudentRows = Prisma.StudentGetPayload<{ include: { memberships: true } }>
      type StudentPatch = Pick<Student, "id"> & Partial<Pick<Student, "lastName">>
    `)
    expect(flagged).toEqual([])
  })

  it("ジェネリック制約は行の写しとみなさない（見本で確かめる）", () => {
    const flagged = scanSample(`
      interface StudentRef {
        id: string
        studentNumber: string
      }
      export function pick<T extends StudentRef>(rows: T[]): T {
        return rows[0]
      }
    `)
    expect(flagged).toEqual([])
  })

  it("DB の行を手で書き写した型が無い", () => {
    expect(scan().violations).toEqual([])
  })

  it("例外の一覧が古びていない（対象のファイルが実在する）", () => {
    // 例外に挙げたファイルが消えたら、一覧からも消す。残しておくと、その場所に
    // 別のものが生えたときに黙って見逃す
    const files = sourceFiles()
    const stale = EXCEPTIONS.filter(
      ({ pattern }) => !files.some((relativePath) => pattern.test(relativePath))
    ).map(({ pattern }) => pattern.source)

    expect(stale).toEqual([])
  })
})
