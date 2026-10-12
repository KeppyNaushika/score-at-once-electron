/**
 * 利用者の秘密（`User.passcode`）が画面側へ渡らないことを、ソースの走査で守る。
 *
 * `passcode` は bcrypt ハッシュで、画面が使う場面は無い（照合は main 側で行う）。
 * 落とす決まりは前からあったが、**書いてあったのは1件ずつ引く `user.ts` の中だけ**で、
 * `include: { user: true }` で関連から連れてくる経路14箇所からは素通りしていた
 * （採点者・招待者・担当者・所有者）。
 *
 * この検査が見張るのは**書き忘れ**である。関連から User を引くところを新しく足すと、
 * `omit` を付けるまでここが落ちる。型検査では捕まらない —— 秘密を含んだ行を返すのも、
 * それ自体は正しい TypeScript だからである。
 */

import * as fs from "fs"
import * as path from "path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")
const MAIN_ROOT = path.join(REPO_ROOT, "electron-src")
const SCHEMA_PATH = path.join(REPO_ROOT, "prisma/schema.prisma")

/**
 * `User` を指す関連の名前（`prisma/schema.prisma` のモデルの中の `名前 User` の左辺）。
 *
 * **手で書き並べない。** 手書きの一覧は関連の改名・追加に追随せず、`decidedBy` が
 * 一覧に無い（`decider` と書かれていた）まま素通りしていた。スキーマから引けば、
 * 関連を足した時点で検査の対象に入る。
 */
function userRelationFields(): Set<string> {
  const schema = fs.readFileSync(SCHEMA_PATH, "utf8")
  const fields = new Set<string>()
  for (const [, body] of schema.matchAll(/model\s+\w+\s*\{([\s\S]*?)\n\}/g)) {
    for (const line of body.split("\n")) {
      const field = /^\s*(\w+)\s+User(?:\?|\[\])?(?:\s|$)/.exec(line)
      if (field) fields.add(field[1])
    }
  }
  return fields
}

const USER_RELATION_FIELDS = userRelationFields()

/** `.ts` を再帰的に集める */
function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(entryPath)
    return entry.isFile() && entryPath.endsWith(".ts") ? [entryPath] : []
  })
}

/** プロパティの名前（識別子・文字列のどちらで書いても同じに読む） */
function propertyNameText(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null
}

/**
 * ソースを構文木で読み、見つけた箇所を `ファイル:行 本文` で返す。
 *
 * **行の正規表現では読まない。** 1行に `include: { user: true, exam: true }` と並べた形や、
 * `omit: {` を改行して書いた形は、行単位の照合をすり抜けていた。
 */
function findInSource(
  sourceText: string,
  displayPath: string,
  matches: (property: ts.PropertyAssignment) => boolean
): string[] {
  const source = ts.createSourceFile(
    displayPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const found: string[] = []
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && matches(node)) {
      const { line } = source.getLineAndCharacterOfPosition(node.getStart())
      found.push(`${displayPath}:${line + 1} ${node.getText()}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/** User を指す関連を `true` で引いている（User の全列を連れてくる） */
function findBareUserRelations(sourceText: string, displayPath: string) {
  return findInSource(sourceText, displayPath, (property) => {
    const name = propertyNameText(property.name)
    return (
      name !== null &&
      USER_RELATION_FIELDS.has(name) &&
      property.initializer.kind === ts.SyntaxKind.TrueKeyword
    )
  })
}

/** `omit` に passcode をその場で書いている */
function findInlinePasscodeOmits(sourceText: string, displayPath: string) {
  return findInSource(sourceText, displayPath, (property) => {
    if (propertyNameText(property.name) !== "omit") return false
    const omitted = property.initializer
    return (
      ts.isObjectLiteralExpression(omitted) &&
      omitted.properties.some(
        (omittedProperty) =>
          omittedProperty.name !== undefined &&
          propertyNameText(omittedProperty.name) === "passcode"
      )
    )
  })
}

/** main 側の全ソースに当てる */
function scanMainSources(
  find: (sourceText: string, displayPath: string) => string[]
): string[] {
  return collectSourceFiles(MAIN_ROOT).flatMap((filePath) =>
    find(
      fs.readFileSync(filePath, "utf8"),
      path.relative(REPO_ROOT, filePath)
    )
  )
}

describe("ユーザーの行を関連から引くときは passcode を落とす", () => {
  it("User を指す関連をスキーマから拾えている（走査の空振りを止める）", () => {
    expect([...USER_RELATION_FIELDS]).toEqual(
      expect.arrayContaining(["user", "inviter", "assigner", "decidedBy"])
    )
  })

  it("走査が書き方によらず拾える（1行に並べた include・改行した omit）", () => {
    const sample = [
      "prisma.exam.findMany({ include: { user: true, exam: true } })",
      "prisma.scoreDecision.findMany({",
      "  include: { decidedBy: true },",
      "})",
      "prisma.user.findMany({",
      "  omit: {",
      "    passcode: true,",
      "  },",
      "})",
      // 落としているものは拾わない
      "prisma.exam.findMany({ include: { user: { omit: PUBLIC_USER_OMIT } } })",
    ].join("\n")

    expect(findBareUserRelations(sample, "sample.ts")).toEqual([
      "sample.ts:1 user: true",
      "sample.ts:3 decidedBy: true",
    ])
    expect(findInlinePasscodeOmits(sample, "sample.ts")).toHaveLength(1)
  })

  it("main 側に素の `user: true` が残っていない", () => {
    // `include: { user: true }` は User の**全列**を連れてくる。落とすには
    // `{ omit: PUBLIC_USER_OMIT }` を書く（Prisma は include の中でも omit を受ける）
    expect(scanMainSources(findBareUserRelations)).toEqual([])
  })

  it("落とす列をその場で書かない（PUBLIC_USER_OMIT を使う）", () => {
    // `omit: { passcode: true }` の手書きは、User に秘密の列が増えたときに追随しない
    expect(scanMainSources(findInlinePasscodeOmits)).toEqual([])
  })

  it("落とすものの宣言は1か所（写しを増やさない）", () => {
    const declarations = collectSourceFiles(MAIN_ROOT).filter((filePath) =>
      /PUBLIC_USER_OMIT\s*=/.test(fs.readFileSync(filePath, "utf8"))
    )

    expect(
      declarations.map((filePath) => path.relative(REPO_ROOT, filePath))
    ).toEqual(["electron-src/lib/prisma/publicUser.ts"])
  })
})
