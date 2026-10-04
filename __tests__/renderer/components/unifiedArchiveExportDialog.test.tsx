// @vitest-environment jsdom
/**
 * 統合アーカイブ（.sao）の書き出しダイアログ（docs/unified-archive-design.md §6）。
 *
 * ここで固定すること:
 * - 押した画面の実体が最初から入って開き、下見はその選択で引かれる。一覧から足せる
 * - 関連して入るものを外すと `exclusions` に入り、「含めない」として残り、画面下の
 *   「含めないもの」に名前と書き出されなくなる行の数が出る（外す前は「全て含めます」）
 * - 成績算出が使うものは外せない（チェック固定・理由つき）
 * - 本人分を選ぶと、今の利用者の id で下見される
 * - 書き出しは 保存先 → 書き出し → 進捗 → 結果（欠けた画像を理由つきで）の順に進む
 * - 外せないものを外していたら、ダイアログの中で知らせて戻せる
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import type { UnifiedArchiveExportInitialSelection } from "@/components/unified-archive/export/types"
import { UnifiedArchiveExportDialog } from "@/components/unified-archive/export/UnifiedArchiveExportDialog"

import { createQueryWrapper } from "../../helpers/queryWrapper"

// 関門（AuthGate）の内側なので、利用者は必ず居る
vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: "user-1", name: "田中先生" }),
}))

beforeAll(() => {
  // cmdk は選択中の項目を scrollIntoView する。jsdom は持たない
  Element.prototype.scrollIntoView = () => {}
})

const EMPTY_ENTITY_IDS = {
  Exam: [],
  Coursework: [],
  Grade: [],
  AsbDefinition: [],
  Student: [],
  Classroom: [],
  SubtotalGroup: [],
  Tag: [],
  User: [],
}

/** 下見の ok の応答 */
function okPreview(overrides: Record<string, unknown> = {}) {
  return {
    kind: "ok",
    rowCounts: { Exam: 1, ExamStudent: 2, Student: 2 },
    excludedRowCounts: {},
    entityIds: { ...EMPTY_ENTITY_IDS, Exam: ["exam-1"] },
    forcedBy: {},
    missingFiles: [],
    ...overrides,
  }
}

const previewExport = vi.fn()
const selectExportPath = vi.fn()
const exportArchive = vi.fn()
/** main から段を押し出す口（購読のコールバック） */
let pushExportProgress: ((phase: string) => void) | null = null

beforeEach(() => {
  previewExport.mockReset()
  selectExportPath.mockReset()
  exportArchive.mockReset()
  pushExportProgress = null
  Object.defineProperty(window, "electronAPI", {
    value: {
      fetchExamsSummary: vi.fn().mockResolvedValue([
        { id: "exam-1", examName: "数学テスト", referenceDate: null },
        { id: "exam-2", examName: "英語テスト", referenceDate: null },
      ]),
      coursework: { getAll: vi.fn().mockResolvedValue([]) },
      grade: {
        getAll: vi
          .fn()
          .mockResolvedValue([
            { id: "grade-1", name: "期末成績", referenceDate: null },
          ]),
      },
      answerSheetBuilder: { listDefinitions: vi.fn().mockResolvedValue([]) },
      fetchStudents: vi.fn().mockResolvedValue([
        {
          id: "student-1",
          lastName: "山田",
          firstName: "太郎",
          lastNameKana: "ヤマダ",
          firstNameKana: "タロウ",
          studentNumber: "1001",
        },
        {
          id: "student-2",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          studentNumber: "1002",
        },
      ]),
      fetchClassrooms: vi.fn().mockResolvedValue([]),
      getSubtotalGroups: vi.fn().mockResolvedValue([]),
      tagGetAll: vi.fn().mockResolvedValue([]),
      fetchUsers: vi
        .fn()
        .mockResolvedValue([{ id: "user-1", name: "田中先生" }]),
      unifiedArchive: {
        previewExport,
        selectExportPath,
        export: exportArchive,
        onExportProgress: (callback: (phase: string) => void) => {
          pushExportProgress = callback
          return () => {
            pushExportProgress = null
          }
        },
      },
    },
    writable: true,
    configurable: true,
  })
})

function renderDialog(initialSelection: UnifiedArchiveExportInitialSelection) {
  render(
    <UnifiedArchiveExportDialog
      open
      onOpenChange={vi.fn()}
      initialSelection={initialSelection}
    />,
    { wrapper: createQueryWrapper() }
  )
  return screen.getByRole("dialog")
}

/** 最後に引かれた下見の選択 */
const lastPreviewSelection = () => previewExport.mock.lastCall?.[0]

describe("統合アーカイブの書き出しダイアログ", () => {
  it("押した画面の実体が最初から入り、その選択で下見する。一覧から足せる", async () => {
    const user = userEvent.setup()
    previewExport.mockResolvedValue(okPreview())
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    const pickedExams = await within(dialog).findByRole("list", {
      name: "選んだ試験",
    })
    expect(
      await within(pickedExams).findByText("数学テスト")
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(lastPreviewSelection()).toEqual({
        roots: { Exam: ["exam-1"] },
        shared: {},
        exclusions: {},
        scoring: { kind: "all" },
        includeAnswers: true,
        optionalItems: [],
      })
    )

    await user.click(
      within(dialog).getByRole("combobox", { name: "生徒を足す" })
    )
    await user.click(await screen.findByRole("option", { name: /佐藤 花子/ }))

    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        roots: { Exam: ["exam-1"] },
        shared: { Student: ["student-2"] },
      })
    )
  })

  it("関連して入るものを外すと exclusions に入り、「含めないもの」に残る", async () => {
    const user = userEvent.setup()
    previewExport.mockImplementation(
      (selection: { exclusions?: Record<string, string[]> }) =>
        Promise.resolve(
          selection.exclusions?.Student
            ? okPreview({
                entityIds: {
                  ...EMPTY_ENTITY_IDS,
                  Exam: ["exam-1"],
                  Student: ["student-2"],
                },
                excludedRowCounts: { Student: 1, ExamStudent: 1 },
              })
            : okPreview({
                entityIds: {
                  ...EMPTY_ENTITY_IDS,
                  Exam: ["exam-1"],
                  Student: ["student-1", "student-2"],
                },
              })
        )
    )
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    expect(
      await within(dialog).findByText("関連するデータを全て含めます")
    ).toBeInTheDocument()

    const relatedStudents = await within(dialog).findByRole("list", {
      name: "関連して含まれる生徒",
    })
    const yamada = within(relatedStudents).getByRole("checkbox", {
      name: "山田 太郎 (1001)",
    })
    expect(yamada).toBeChecked()
    await user.click(yamada)

    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        exclusions: { Student: ["student-1"] },
      })
    )

    // 外した行は「含めない」として残り、もう一度チェックすれば戻せる
    const excludedRow = await within(relatedStudents).findByText("含めない")
    expect(excludedRow.closest("li")).toHaveTextContent("山田 太郎 (1001)")
    expect(
      within(relatedStudents).getByRole("checkbox", {
        name: "山田 太郎 (1001)",
      })
    ).not.toBeChecked()

    const excludedSummary = within(dialog).getByRole("region", {
      name: "含めないもの",
    })
    expect(excludedSummary).toHaveTextContent("生徒: 山田 太郎 (1001)")
    expect(
      await within(excludedSummary).findByText(/受験生徒 1件/)
    ).toBeInTheDocument()
    expect(
      within(dialog).queryByText("関連するデータを全て含めます")
    ).not.toBeInTheDocument()
  })

  it("成績算出が使うものはチェックを固定し、理由を添える", async () => {
    previewExport.mockResolvedValue(
      okPreview({
        entityIds: {
          ...EMPTY_ENTITY_IDS,
          Grade: ["grade-1"],
          Exam: ["exam-1"],
        },
        forcedBy: { "Exam:exam-1": ["grade-1"] },
      })
    )
    const dialog = renderDialog({ roots: { Grade: ["grade-1"] } })

    const relatedExams = await within(dialog).findByRole("list", {
      name: "関連して含まれる試験",
    })
    const examCheckbox = await within(relatedExams).findByRole("checkbox", {
      name: "数学テスト",
    })
    expect(examCheckbox).toBeChecked()
    expect(examCheckbox).toBeDisabled()
    expect(
      within(relatedExams).getByText("成績算出『期末成績』が使うため")
    ).toBeInTheDocument()
  })

  it("本人分を選ぶと、今の利用者の採点だけで下見する", async () => {
    const user = userEvent.setup()
    previewExport.mockResolvedValue(okPreview())
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    await user.click(
      within(dialog).getByRole("radio", {
        name: /本人分の採点だけ（田中先生）/,
      })
    )

    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        scoring: { kind: "self", userId: "user-1" },
      })
    )
  })

  it("保存先 → 書き出し → 進捗 → 結果（欠けた画像は理由つき）の順に進む", async () => {
    const user = userEvent.setup()
    previewExport.mockResolvedValue(okPreview())
    selectExportPath.mockResolvedValue("/out/数学テスト.sao")
    let finishExport: (exported: unknown) => void = () => {}
    exportArchive.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishExport = resolve
        })
    )
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    const exportButton = within(dialog).getByRole("button", {
      name: "書き出し",
    })
    await waitFor(() => expect(exportButton).toBeEnabled())
    await user.click(exportButton)

    expect(selectExportPath).toHaveBeenCalledWith("数学テスト.sao")
    await waitFor(() =>
      expect(exportArchive).toHaveBeenCalledWith({
        selection: lastPreviewSelection(),
        outputPath: "/out/数学テスト.sao",
      })
    )

    pushExportProgress?.("packing")
    expect(
      await within(dialog).findByText("ファイルをまとめています")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByRole("button", { name: "キャンセル" })
    ).toBeDisabled()

    finishExport({
      outputPath: "/out/数学テスト.sao",
      manifest: {
        files: {
          count: 3,
          missing: [{ path: "answers/1.png", reason: "notFound" }],
        },
      },
    })

    expect(
      await within(dialog).findByText("1件を書き出しました")
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText("画像が欠けたまま書き出しました")
    ).toBeInTheDocument()
    await user.click(within(dialog).getByRole("button", { name: /数学テスト/ }))
    expect(
      within(dialog).getByText("見つからない: answers/1.png")
    ).toBeInTheDocument()
  })

  it("保存先を選ばずに閉じたら、書き出さない", async () => {
    const user = userEvent.setup()
    previewExport.mockResolvedValue(okPreview())
    selectExportPath.mockResolvedValue(null)
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    const exportButton = within(dialog).getByRole("button", {
      name: "書き出し",
    })
    await waitFor(() => expect(exportButton).toBeEnabled())
    await user.click(exportButton)

    await waitFor(() => expect(selectExportPath).toHaveBeenCalled())
    expect(exportArchive).not.toHaveBeenCalled()
  })

  it("外せないものを外していたら、ダイアログの中で知らせて戻せる", async () => {
    const user = userEvent.setup()
    previewExport.mockImplementation(
      (selection: { exclusions?: Record<string, string[]> }) =>
        Promise.resolve(
          selection.exclusions?.Exam
            ? {
                kind: "forcedExcluded",
                violations: [
                  {
                    table: "GradeDataSource",
                    id: "source-1",
                    column: "examId",
                    target: "Exam(exam-1)",
                  },
                ],
              }
            : okPreview({
                entityIds: {
                  ...EMPTY_ENTITY_IDS,
                  Grade: ["grade-1"],
                  Exam: ["exam-1"],
                },
              })
        )
    )
    const dialog = renderDialog({ roots: { Grade: ["grade-1"] } })

    const relatedExams = await within(dialog).findByRole("list", {
      name: "関連して含まれる試験",
    })
    await user.click(
      await within(relatedExams).findByRole("checkbox", { name: "数学テスト" })
    )

    const alert = await within(dialog).findByText(
      "成績算出が使うものを「含めない」にしているため、書き出せません"
    )
    const alertBand = alert.closest("[role=alert]")
    expect(alertBand).toHaveTextContent("試験『数学テスト』")
    expect(
      within(dialog).getByRole("button", { name: "書き出し" })
    ).toBeDisabled()

    await user.click(
      within(dialog).getByRole("button", { name: "含める側へ戻す" })
    )
    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({ exclusions: {} })
    )
    await waitFor(() =>
      expect(
        within(dialog).queryByText(
          "成績算出が使うものを「含めない」にしているため、書き出せません"
        )
      ).not.toBeInTheDocument()
    )
  })
})
