// @vitest-environment jsdom
/**
 * 一括書き出しの結果が、**画面まで届く**ことの検証。
 *
 * アーカイブは画像の実体が見つからなくても作られる（壊れておらず、取り込みも成功する）。
 * だから main が集めた `missingFiles` を画面が落とすと、**画像が1枚も入っていなくても
 * 「5件の試験を書き出しました」**と言うことになり、受け取った同僚が答案画像の無い試験を
 * 警告なしで取り込む。
 *
 * ここで固定するのは次の2つ:
 * - 欠けたファイルが、書き出し元ごとに件数で出て、開くとファイル名が全部出ること
 * - 試験ごとの失敗が、数ではなく名前とエラー内容で出ること
 */

import "../setup"

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import ExamList from "@/components/exams/list/ExamList"

import { createQueryWrapper } from "../../helpers/queryWrapper"

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}))

const bulkExportExams = vi.fn()

/** 一覧に出す試験（進捗計算が読む形だけ持つ） */
function createExamSummary(id: string, examName: string) {
  return {
    id,
    examName,
    examDate: null,
    description: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    tags: [],
    examPages: [],
    cropRegions: [],
    answerImages: [],
    examStudents: [],
    examSubtotalGroups: [],
  }
}

beforeEach(() => {
  bulkExportExams.mockReset()
  Object.defineProperty(window, "electronAPI", {
    value: {
      fetchExamsSummary: vi
        .fn()
        .mockResolvedValue([
          createExamSummary("exam-1", "数学テスト"),
          createExamSummary("exam-2", "英語テスト"),
        ]),
      tagGetAll: vi.fn().mockResolvedValue([]),
      archive: { bulkExportExams },
    },
    writable: true,
    configurable: true,
  })
})

/** 2件を選び、範囲を選ぶ段から書き出しを実行するところまで進める */
async function exportSelectedExams(user: ReturnType<typeof userEvent.setup>) {
  render(<ExamList />, { wrapper: createQueryWrapper() })

  await screen.findByText("数学テスト")
  await user.click(screen.getByRole("checkbox", { name: "全選択" }))
  await user.click(screen.getByRole("button", { name: /\.score 一括書き出し/ }))

  const selectStage = await screen.findByRole("dialog")
  await user.click(
    within(selectStage).getByRole("button", { name: "書き出し" })
  )
}

describe("一括書き出しの結果", () => {
  it("欠けた画像が書き出し元ごとに出て、開くとファイル名が全部出る", async () => {
    const user = userEvent.setup()
    bulkExportExams.mockResolvedValue({
      canceled: false,
      outputDirectory: "/out",
      results: [
        {
          examId: "exam-1",
          examName: "数学テスト",
          success: true,
          outputPath: "/out/数学テスト.score",
          missingFiles: ["答案画像: 1_page1.png", "模範解答画像: page1.png"],
        },
        {
          examId: "exam-2",
          examName: "英語テスト",
          success: true,
          outputPath: "/out/英語テスト.score",
          missingFiles: [],
        },
      ],
    })

    await exportSelectedExams(user)

    const resultStage = await screen.findByRole("dialog")
    expect(
      await within(resultStage).findByText("2件を書き出しました")
    ).toBeInTheDocument()
    expect(
      within(resultStage).getByText("画像が欠けたまま書き出しました")
    ).toBeInTheDocument()
    expect(
      within(resultStage).getByText(
        "受け取った側では、その画像が表示されません。"
      )
    ).toBeInTheDocument()

    // 畳んである間は件数だけ、開くとファイル名が全部出る
    expect(
      within(resultStage).queryByText(/答案画像: 1_page1\.png/)
    ).not.toBeInTheDocument()
    await user.click(
      within(resultStage).getByRole("button", { name: /数学テスト/ })
    )
    const missingFiles = within(resultStage).getByText(/答案画像: 1_page1\.png/)
    expect(missingFiles).toHaveTextContent("模範解答画像: page1.png")

    // 欠けの無い試験は一覧に出さない（件数の行が増えない）
    expect(
      within(resultStage).queryByRole("button", { name: /英語テスト/ })
    ).not.toBeInTheDocument()
  })

  it("失敗した試験は、数ではなく名前とエラー内容で出る", async () => {
    const user = userEvent.setup()
    bulkExportExams.mockResolvedValue({
      canceled: false,
      outputDirectory: "/out",
      results: [
        {
          examId: "exam-1",
          examName: "数学テスト",
          success: true,
          outputPath: "/out/数学テスト.score",
          missingFiles: [],
        },
        {
          examId: "exam-2",
          examName: "英語テスト",
          success: false,
          error: "試験が見つかりません",
          missingFiles: [],
        },
      ],
    })

    await exportSelectedExams(user)

    const resultStage = await screen.findByRole("dialog")
    expect(
      await within(resultStage).findByText("1件を書き出し、1件は失敗しました")
    ).toBeInTheDocument()
    expect(
      within(resultStage).getByText("失敗した書き出し")
    ).toBeInTheDocument()
    const failedExam = within(resultStage).getByText("英語テスト")
    expect(failedExam.parentElement).toHaveTextContent("試験が見つかりません")
  })
})
