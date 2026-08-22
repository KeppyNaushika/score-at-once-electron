/**
 * 4つのトップページ（試験 / 試験外成績資料 / 成績算出 / 解答用紙）が
 * **同じ一覧部品に載っている**ことを、ソースの走査で守る（段階64）。
 *
 * 列の並びそのものは `entityListPage.test.tsx` が固定している。ここで見るのは
 * **どの画面もその部品を通っているか**で、これは型検査では捕まらない —— 画面が
 * 自前で `<Table>` を組み直しても、それ自体は正しい TypeScript だからである。
 * 実際、段階64 の前は4画面とも `Table` を手で組んでおり、`ListFilterBar` を
 * 共有していてなお列も当たり判定も4通りに割れていた。
 *
 * ついでに固定するもの:
 *
 * - **「詳細」の語を残さない**（行そのものが概要への導線。語は「概要」へ）
 * - **成績の一覧が「試験」の語を使っていない**（中身は成績算出試験だが、試験一覧と
 *   同じ語で呼ぶと、どちらの一覧を見ているのか見分けが付かない）
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../../..")

/** 段階64 の対象4画面（一覧の実装ファイル） */
const LIST_FILES = {
  試験: "src/components/exams/list/ExamList.tsx",
  試験外成績資料: "src/components/coursework/list/CourseworkListContainer.tsx",
  成績算出: "src/components/grades/list/GradeListContainer.tsx",
  解答用紙: "src/components/answer-sheet-builder/AnswerSheetDefinitionList.tsx",
} as const

/** 4画面のトップページ（ヘッダーは一覧部品が持つので、ここは一覧を置くだけ） */
const PAGE_FILES = [
  "src/app/(app)/exams/page.tsx",
  "src/app/(app)/coursework/page.tsx",
  "src/app/(app)/grades/page.tsx",
  "src/app/(app)/answer-sheet-builder/page.tsx",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8")
}

describe("4つのトップページは同じ一覧部品に載る", () => {
  for (const [screenName, listFile] of Object.entries(LIST_FILES)) {
    const source = readSource(listFile)

    it(`${screenName}: EntityListPage を通す`, () => {
      expect(source).toContain(
        'import { EntityListPage } from "@/components/common/EntityListPage"'
      )
      expect(source).toContain("<EntityListPage")
    })

    it(`${screenName}: 表を自前で組み直さない`, () => {
      // 列・当たり判定・並べ替えは部品の中に1つだけ在る。ここで table を
      // 組み始めた時点で、また画面ごとに割れる
      expect(source).not.toContain('from "@/components/ui/table"')
      expect(source).not.toContain("<TableHead")
      expect(source).not.toContain("<TableRow")
    })

    it(`${screenName}: 並べ替えを自前で持たない`, () => {
      // 解答用紙が持っていた `sortIndicator`（自前の ↑↓）は捨て、
      // 並べ替えは部品の中の `SortableTableHead` に寄せた
      expect(source).not.toContain("sortIndicator")
      expect(source).not.toContain("useTableSort")
    })

    it(`${screenName}: 「詳細」の語を残さない`, () => {
      expect(source).not.toContain("詳細")
    })
  }

  for (const pageFile of PAGE_FILES) {
    it(`${pageFile}: ヘッダーを二重に被せない`, () => {
      const source = readSource(pageFile)
      // 題・戻る／進む・操作は `EntityListPage` のヘッダー1行が持つ。
      // `PageHeader` を重ねると行が2つになり、詳細画面と姿が揃わない
      expect(source).not.toContain("PageHeader")
    })
  }
})

describe("成績算出の一覧は試験の文言を使わない", () => {
  const source = readSource(LIST_FILES.成績算出)

  it("列見出し・空のとき・絞り込みで0件のときの語が「試験」でない", () => {
    // 「試験名」「最初の試験を作成」「条件に一致する試験がありません」が
    // 試験一覧からそのまま残っていた
    expect(source).not.toContain("試験名")
    expect(source).not.toContain("最初の試験を作成")
    expect(source).not.toContain("条件に一致する試験がありません")
  })

  it("空のときの導線と絞り込みの結果は「成績算出」で言う", () => {
    expect(source).toContain("最初の成績算出を作成")
    expect(source).toContain("条件に一致する成績算出がありません")
  })
})
