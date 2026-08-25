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
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../..")
const MAIN_ROOT = path.join(REPO_ROOT, "electron-src")

/** `User` を指す関連の名前（`prisma/schema.prisma` の `... User @relation` の左辺） */
const USER_RELATION_FIELDS = [
  "user",
  "inviter",
  "assigner",
  "owner",
  "decider",
] as const

/** `.ts` を再帰的に集める */
function collectSourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(entryPath)
    return entry.isFile() && entryPath.endsWith(".ts") ? [entryPath] : []
  })
}

describe("ユーザーの行を関連から引くときは passcode を落とす", () => {
  it("main 側に素の `user: true` が残っていない", () => {
    // `include: { user: true }` は User の**全列**を連れてくる。落とすには
    // `{ omit: PUBLIC_USER_OMIT }` を書く（Prisma は include の中でも omit を受ける）
    const bareIncludes = collectSourceFiles(MAIN_ROOT).flatMap((filePath) => {
      const lines = fs.readFileSync(filePath, "utf8").split("\n")
      return lines.flatMap((line, lineIndex) => {
        const match = /^\s*(\w+): true,?\s*$/.exec(line)
        if (!match) return []
        const relationField = match[1]
        const isUserRelation = USER_RELATION_FIELDS.some(
          (userRelationField) => userRelationField === relationField
        )
        if (!isUserRelation) return []
        return [
          `${path.relative(REPO_ROOT, filePath)}:${lineIndex + 1} ${line.trim()}`,
        ]
      })
    })

    expect(bareIncludes).toEqual([])
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
