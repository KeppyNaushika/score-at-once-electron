/**
 * 4つの概要ページ（試験 / 成績算出 / 試験外成績資料 / 解答用紙）が
 * **同じ概要部品に載っている**ことを、ソースの走査で守る（段階66）。
 *
 * 並びや進み具合の出し方は `entityOverviewPage.test.tsx` が固定している。ここで
 * 見るのは**どの画面もその部品を通っているか**で、これは型検査では捕まらない ——
 * 画面が自前で `<Card>` を組み直しても、それ自体は正しい TypeScript だからである。
 * 実際、段階66 の前は成績の概要が試験の形を**丸ごと手で書き写して 486 行**あり、
 * ヘッダー・進捗カード・段カード・編集モーダルが4画面で4通りに割れていた。
 *
 * ついでに固定するもの:
 *
 * - **基本設定のモーダルを復活させない**（名前・日付・説明・タグは概要で直に書く）
 * - **全体の進捗バーを復活させない**
 * - **作成ダイアログを復活させない**（押したら既定値の1件を作って概要へ直行する）
 * - **`?setup=1` を復活させない**（作成直後に開く先が概要ページそのものになった）
 */

import * as fs from "fs"
import * as path from "path"
import { describe, expect, it } from "vitest"

const REPO_ROOT = path.resolve(__dirname, "../../..")

/** 段階66 の対象4画面（概要の実装ファイル） */
const OVERVIEW_FILES = {
  試験: "src/app/(app)/exams/[examId]/page.tsx",
  成績算出: "src/app/(app)/grades/[gradeId]/page.tsx",
  試験外成績資料: "src/components/coursework/CourseworkDetail.tsx",
  解答用紙:
    "src/components/answer-sheet-builder/AnswerSheetDefinitionDetail.tsx",
} as const

/** 一覧の「新規作成」を持つ3画面（解答用紙は段階64 以前から既にこの形） */
const LIST_FILES = {
  試験: "src/components/exams/list/ExamList.tsx",
  成績算出: "src/components/grades/list/GradeListContainer.tsx",
  試験外成績資料: "src/components/coursework/list/CourseworkListContainer.tsx",
} as const

/** 段階66 で落とした、二度と戻さないファイル */
const REMOVED_FILES = [
  // 基本設定のモーダル（3実体ぶん）
  "src/components/exams/forms/EditExamWindow.tsx",
  "src/components/grades/EditGradeWindow.tsx",
  "src/components/coursework/EditCourseworkWindow.tsx",
  // 作成ダイアログ（3実体ぶん）
  "src/components/exams/forms/CreateExamWindow.tsx",
  "src/components/grades/list/GradeCreateDialog.tsx",
  "src/components/coursework/list/CourseworkCreateDialog.tsx",
  // 試験の概要だけが持っていた部品（共通部品へ畳んだ）
  "src/components/exams/detail/ExamHeader.tsx",
  "src/components/exams/detail/OverallProgress.tsx",
  "src/components/exams/detail/QuickStats.tsx",
  "src/components/exams/detail/PhaseCard.tsx",
  "src/components/exams/detail/types.ts",
  "src/components/exams/detail/hooks/useWorkflowData.ts",
] as const

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8")
}

describe("4つの概要ページは同じ部品に載る", () => {
  for (const [screenName, overviewFile] of Object.entries(OVERVIEW_FILES)) {
    const source = readSource(overviewFile)

    it(`${screenName}: EntityOverviewPage を通す`, () => {
      expect(source).toContain('from "@/components/common/EntityOverviewPage"')
      expect(source).toContain("<EntityOverviewPage")
    })

    it(`${screenName}: 段カードを自前で組み直さない`, () => {
      // 進み具合の出し方・段の名前・行き先は部品の中に1つだけ在る。
      // ここで Card を組み始めた時点で、また画面ごとに割れる
      expect(source).not.toContain('from "@/components/ui/card"')
      expect(source).not.toContain("<Progress")
    })

    it(`${screenName}: 基本設定のモーダルを開かない`, () => {
      // 名前・日付・説明・タグは概要で直に書く（別の窓を開いて保存して閉じない）
      expect(source).not.toContain("EditExamWindow")
      expect(source).not.toContain("EditGradeWindow")
      expect(source).not.toContain("EditCourseworkWindow")
    })

    it(`${screenName}: 段の名前を書き写さない（workflowTabs から引く）`, () => {
      expect(source).toContain('from "@/lib/workflowTabs"')
    })
  }
})

describe("一覧の新規作成はダイアログを出さない", () => {
  for (const [screenName, listFile] of Object.entries(LIST_FILES)) {
    const source = readSource(listFile)

    it(`${screenName}: 作成ダイアログを持たない`, () => {
      expect(source).not.toContain("CreateExamWindow")
      expect(source).not.toContain("GradeCreateDialog")
      expect(source).not.toContain("CourseworkCreateDialog")
    })

    it(`${screenName}: id を renderer で振って既定値の1件を作る`, () => {
      expect(source).toContain("crypto.randomUUID()")
      expect(source).toContain("const handleCreate = useCallback(async () => {")
    })

    it(`${screenName}: 作成直後の導線が概要ページへ向く`, () => {
      // ここが死ぬと、作ったのにどこへも行かない（旧 `?setup=1` の代わり）
      expect(source).toMatch(/router\.push\(`\/[a-z-]+\/\$\{\w+Id\}`\)/)
      // 作成直後に基本設定のモーダルを自動で開く仕掛けは経路ごと落とした
      // （落とした経緯を書いた注釈は残るので、行き先そのものだけを見る）
      expect(source).not.toMatch(/router\.push\([^)]*setup=1/)
    })
  }
})

describe("概要ページに残らないもの", () => {
  it("?setup=1 を読む画面がもう無い", () => {
    for (const overviewFile of Object.values(OVERVIEW_FILES)) {
      expect(readSource(overviewFile)).not.toContain("setup")
    }
  })

  it("落としたファイルが復活していない", () => {
    const revived = REMOVED_FILES.filter((relativePath) =>
      fs.existsSync(path.join(REPO_ROOT, relativePath))
    )
    expect(revived).toEqual([])
  })
})
