// @vitest-environment jsdom
/**
 * 統合アーカイブ（.sao）の書き出しダイアログ（docs/unified-archive-design.md §6）。
 *
 * ここで固定すること:
 * - 種ごとに1つの常時展開チェック一覧。押した画面の実体が「選択中」の行として並び、下見は
 *   その選択で引かれる。選んでいない行をチェックすると roots / shared に入る
 * - 関連して入る行のチェックを外すと `exclusions` に入り、「含めない」として残り、画面下の
 *   「含めないもの」に名前と書き出されなくなる行の数が出る（外す前は「全て含めます」）
 * - 成績算出が使うものは外せない（鍵と理由。選んでも入れ替わらない）
 * - チェックの入った行に当てると、その行を外した選択で下見を引き、一緒に消える行を赤枠で
 *   囲み、当てた行の右端に「○件の選択を解除」（外せなければ「外せません」）を赤字で出す。
 *   同じ行に戻っても引き直さない
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
          // 1年1組に在籍中
          memberships: [
            {
              classroomId: "classroom-1",
              startDate: "2026-04-01",
              endDate: null,
            },
          ],
        },
        {
          id: "student-2",
          lastName: "佐藤",
          firstName: "花子",
          lastNameKana: "サトウ",
          firstNameKana: "ハナコ",
          studentNumber: "1002",
          // 1年1組に過去に在籍していた
          memberships: [
            {
              classroomId: "classroom-1",
              startDate: "2025-04-01",
              endDate: "2026-03-31",
            },
          ],
        },
      ]),
      fetchClassrooms: vi.fn().mockResolvedValue([
        {
          id: "classroom-1",
          name: "1年1組",
          classroomCode: "C11",
          grade: 1,
          description: null,
          isVisible: true,
        },
      ]),
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

/** 種の一覧（listbox） */
const findKindList = (dialog: HTMLElement, kindLabel: string) =>
  within(dialog).findByRole("listbox", { name: `${kindLabel}の一覧` })

/** 外すと一緒に外れる（赤枠の）行の読み上げに添える文言 */
const LOST_TEXT = "外すと一緒に外れます"

describe("統合アーカイブの書き出しダイアログ", () => {
  it("押した画面の実体が選んだ行として並び、その選択で下見する", async () => {
    previewExport.mockResolvedValue(okPreview())
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    const examList = await findKindList(dialog, "試験")
    // 選んだもの → 入らないもの の順
    await waitFor(() =>
      expect(
        within(examList)
          .getAllByRole("option")
          .map((option) => option.textContent)
      ).toEqual(["数学テスト選択中", "英語テスト"])
    )
    // 開いた直後は、どの一覧にも今いる行が無い（触れていない一覧の先頭を選ばない）
    expect(
      within(dialog)
        .getAllByRole("option")
        .filter((option) => option.getAttribute("aria-selected") === "true")
    ).toEqual([])
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
  })

  it("選んでいない行をチェックすると roots / shared に入り、もう一度で外れる", async () => {
    const user = userEvent.setup()
    previewExport.mockResolvedValue(okPreview())
    const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

    const examList = await findKindList(dialog, "試験")
    await user.click(
      await within(examList).findByRole("option", { name: "英語テスト" })
    )
    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        roots: { Exam: ["exam-1", "exam-2"] },
      })
    )
    expect(
      within(examList).getByRole("option", { name: /英語テスト.*選択中/ })
    ).toBeInTheDocument()

    // キーボードでも: 生徒の一覧の検索欄で絞って Enter
    const studentList = await findKindList(dialog, "生徒")
    await user.click(
      within(dialog).getByRole("combobox", { name: "生徒の一覧" })
    )
    await user.keyboard("はなこ{Enter}")
    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        shared: { Student: ["student-2"] },
      })
    )
    expect(
      within(studentList).getByRole("option", { name: /佐藤 花子.*選択中/ })
    ).toBeInTheDocument()

    await user.click(
      within(examList).getByRole("option", { name: /英語テスト.*選択中/ })
    )
    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        roots: { Exam: ["exam-1"] },
      })
    )
  })

  it("関連して入る行のチェックを外すと exclusions に入り、「含めない」として残る", async () => {
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

    const studentList = await findKindList(dialog, "生徒")
    await user.click(
      await within(studentList).findByRole("option", {
        name: /山田 太郎 \(1001\).*関連で入る/,
      })
    )

    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({
        exclusions: { Student: ["student-1"] },
      })
    )

    // 外した行は「含めない」として残る（関連で入る行の後ろ）
    const excludedOption = await within(studentList).findByRole("option", {
      name: /山田 太郎 \(1001\).*含めない/,
    })
    expect(
      within(studentList)
        .getAllByRole("option")
        .map((option) => option.textContent)
    ).toEqual(["佐藤 花子 (1002)関連で入る", "山田 太郎 (1001)含めない"])

    const excludedSummary = within(dialog).getByRole("region", {
      name: "含めないもの",
    })
    expect(excludedSummary).toHaveTextContent("生徒: 山田 太郎 (1001)")
    expect(
      await within(excludedSummary).findByText(/受験生徒 1件/)
    ).toBeInTheDocument()

    // もう一度チェックすれば戻る
    await user.click(excludedOption)
    await waitFor(() =>
      expect(lastPreviewSelection()).toMatchObject({ exclusions: {} })
    )
    expect(
      await within(dialog).findByText("関連するデータを全て含めます")
    ).toBeInTheDocument()
  })

  it("成績算出が使う行は鍵と理由を出し、選んでも入れ替わらない", async () => {
    const user = userEvent.setup()
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

    const examList = await findKindList(dialog, "試験")
    const forcedOption = await within(examList).findByRole("option", {
      name: /数学テスト.*成績算出『期末成績』が使うため/,
    })
    const callCount = previewExport.mock.calls.length
    await user.click(forcedOption)

    expect(
      within(examList).getByRole("option", {
        name: /数学テスト.*成績算出『期末成績』が使うため/,
      })
    ).toBeInTheDocument()
    // 選択は変わらないので、下見も引き直さない
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(previewExport.mock.calls.length).toBe(callCount)
    expect(lastPreviewSelection()).toMatchObject({ exclusions: {} })
  })

  describe("チェックの入った行に当てると、外したときに一緒に外れるものを示す", () => {
    /** 生徒1を外すと、生徒1だけが在籍する学級と、生徒1の受験・採点・答案が消える */
    const mockPreviewWithRemoval = () =>
      previewExport.mockImplementation(
        (selection: { exclusions?: Record<string, string[]> }) => {
          const excludedStudentIds = selection.exclusions?.Student ?? []
          if (excludedStudentIds.includes("student-1")) {
            return Promise.resolve(
              okPreview({
                entityIds: {
                  ...EMPTY_ENTITY_IDS,
                  Exam: ["exam-1"],
                  Student: ["student-2"],
                },
                rowCounts: {
                  Exam: 1,
                  ExamStudent: 1,
                  Student: 1,
                  QuestionScore: 617,
                  StudentAnswerImage: 28,
                },
              })
            )
          }
          if (excludedStudentIds.includes("student-2")) {
            return Promise.resolve(
              okPreview({
                entityIds: {
                  ...EMPTY_ENTITY_IDS,
                  Exam: ["exam-1"],
                  Student: ["student-1"],
                  Classroom: ["classroom-1"],
                },
                rowCounts: {
                  Exam: 1,
                  ExamStudent: 1,
                  Student: 1,
                  Classroom: 1,
                  QuestionScore: 617,
                  StudentAnswerImage: 28,
                },
              })
            )
          }
          return Promise.resolve(
            okPreview({
              entityIds: {
                ...EMPTY_ENTITY_IDS,
                Exam: ["exam-1"],
                Student: ["student-1", "student-2"],
                Classroom: ["classroom-1"],
              },
              rowCounts: {
                Exam: 1,
                ExamStudent: 2,
                Student: 2,
                Classroom: 1,
                QuestionScore: 1234,
                StudentAnswerImage: 56,
              },
            })
          )
        }
      )

    /** 生徒1を外した選択で下見を引いた回数 */
    const removalPreviewCount = (studentId: string) =>
      previewExport.mock.calls.filter(([selection]) =>
        (selection.exclusions?.Student ?? []).includes(studentId)
      ).length

    it("外した選択で下見を引き、消える行を赤枠に、当てた行の右端に解除される件数を赤字で出す", async () => {
      const user = userEvent.setup()
      mockPreviewWithRemoval()
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

      const studentList = await findKindList(dialog, "生徒")
      const classroomList = await findKindList(dialog, "学級")
      const yamadaOption = await within(studentList).findByRole("option", {
        name: /山田 太郎.*関連で入る/,
      })
      await user.hover(yamadaOption)

      // ふだんの状態は見た目だけ隠し、読み上げには両方入る
      await waitFor(() =>
        expect(yamadaOption).toHaveTextContent(
          "山田 太郎 (1001)関連で入る1件の選択を解除"
        )
      )
      expect(within(yamadaOption).getByText("1件の選択を解除")).toHaveClass(
        "text-destructive"
      )
      expect(within(yamadaOption).getByText("関連で入る")).toHaveClass(
        "opacity-0"
      )
      expect(lastPreviewSelection()).toMatchObject({
        roots: { Exam: ["exam-1"] },
        exclusions: { Student: ["student-1"] },
      })
      // 学級は生徒1と一緒に消える。当てた行そのものと、残る行は赤枠にしない
      expect(
        within(classroomList).getByRole("option", {
          name: new RegExp(`1年1組.*${LOST_TEXT}`),
        })
      ).toBeInTheDocument()
      expect(
        within(studentList).queryByRole("option", {
          name: new RegExp(LOST_TEXT),
        })
      ).not.toBeInTheDocument()
      expect(
        within(dialog).getByRole("listbox", { name: "試験の一覧" })
      ).not.toHaveTextContent(LOST_TEXT)

      // チェックの無い行では引かず、赤字も赤枠も消える
      await user.hover(
        within(dialog).getByRole("option", { name: "英語テスト" })
      )
      await waitFor(() =>
        expect(
          within(classroomList).queryByRole("option", {
            name: new RegExp(LOST_TEXT),
          })
        ).not.toBeInTheDocument()
      )
      expect(
        within(dialog).queryByText(/件の選択を解除/)
      ).not.toBeInTheDocument()
    })

    it("一緒に外れるものが無い行には、赤字を出さない", async () => {
      const user = userEvent.setup()
      mockPreviewWithRemoval()
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

      const studentList = await findKindList(dialog, "生徒")
      const satoOption = await within(studentList).findByRole("option", {
        name: /佐藤 花子.*関連で入る/,
      })
      await user.hover(satoOption)

      await waitFor(() => expect(removalPreviewCount("student-2")).toBe(1))
      // 下見が届いてからも、ふだんの状態のまま
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(satoOption).toHaveTextContent(/^佐藤 花子 \(1002\)関連で入る$/)
      expect(
        within(dialog).queryByText(/件の選択を解除/)
      ).not.toBeInTheDocument()
    })

    it("同じ行に戻ったときは、下見を引き直さない", async () => {
      const user = userEvent.setup()
      mockPreviewWithRemoval()
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })

      const studentList = await findKindList(dialog, "生徒")
      const yamadaOption = await within(studentList).findByRole("option", {
        name: /山田 太郎.*関連で入る/,
      })
      const satoOption = within(studentList).getByRole("option", {
        name: /佐藤 花子.*関連で入る/,
      })

      await user.hover(yamadaOption)
      expect(
        await within(yamadaOption).findByText("1件の選択を解除")
      ).toBeInTheDocument()
      await user.hover(satoOption)
      await waitFor(() => expect(removalPreviewCount("student-2")).toBe(1))
      expect(within(yamadaOption).queryByText("1件の選択を解除")).toBeNull()
      await user.hover(yamadaOption)
      expect(
        await within(yamadaOption).findByText("1件の選択を解除")
      ).toBeInTheDocument()

      expect(removalPreviewCount("student-1")).toBe(1)
      expect(removalPreviewCount("student-2")).toBe(1)
    })

    it("外すと成績算出が使うものが外れる行には「外せません」と理由を出す", async () => {
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
                      column: "cropRegionId",
                      target: "CropRegion(crop-1)",
                    },
                  ],
                }
              : okPreview({
                  entityIds: {
                    ...EMPTY_ENTITY_IDS,
                    Grade: ["grade-1"],
                    Exam: ["exam-1"],
                  },
                  forcedBy: { "CropRegion:crop-1": ["grade-1"] },
                })
          )
      )
      const dialog = renderDialog({ roots: { Grade: ["grade-1"] } })

      const examList = await findKindList(dialog, "試験")
      const examOption = await within(examList).findByRole("option", {
        name: /数学テスト.*関連で入る/,
      })
      await user.hover(examOption)

      const cannotRemove = await within(examOption).findByText("外せません")
      expect(cannotRemove).toHaveClass("text-destructive")
      expect(cannotRemove).toHaveAttribute(
        "title",
        "成績算出『期末成績』が使うため"
      )
      expect(examOption).toHaveTextContent(
        "数学テスト関連で入る外せません成績算出『期末成績』が使うため"
      )
    })
  })

  describe("見出しの全選択", () => {
    const selectAllOf = (dialog: HTMLElement, kindLabel: string) =>
      within(dialog).getByRole("checkbox", {
        name: `表示中の${kindLabel}を全て選ぶ`,
      })

    it("全部選ぶと入っていない行を選び、一部のときは indeterminate", async () => {
      const user = userEvent.setup()
      previewExport.mockResolvedValue(okPreview())
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      await findKindList(dialog, "試験")

      await waitFor(() =>
        expect(selectAllOf(dialog, "試験")).toHaveAttribute(
          "aria-checked",
          "mixed"
        )
      )
      await user.click(selectAllOf(dialog, "試験"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          roots: { Exam: ["exam-1", "exam-2"] },
        })
      )
      expect(selectAllOf(dialog, "試験")).toHaveAttribute(
        "aria-checked",
        "true"
      )
    })

    it("全部外すと関連の行は「含めない」へ、もう一度で戻る。検索で絞れば見えている行だけ", async () => {
      const user = userEvent.setup()
      previewExport.mockResolvedValue(
        okPreview({
          entityIds: {
            ...EMPTY_ENTITY_IDS,
            Exam: ["exam-1"],
            Student: ["student-1", "student-2"],
          },
        })
      )
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      const studentList = await findKindList(dialog, "生徒")
      await within(studentList).findByRole("option", {
        name: /山田 太郎.*関連で入る/,
      })

      await user.click(selectAllOf(dialog, "生徒"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          exclusions: { Student: ["student-1", "student-2"] },
        })
      )
      await user.click(selectAllOf(dialog, "生徒"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({ exclusions: {} })
      )

      await user.type(
        within(dialog).getByRole("combobox", { name: "生徒の一覧" }),
        "やまだ"
      )
      await user.click(selectAllOf(dialog, "生徒"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          exclusions: { Student: ["student-1"] },
        })
      )
    })

    it("外せない行は全選択でも変わらない", async () => {
      const user = userEvent.setup()
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
      const examList = await findKindList(dialog, "試験")
      await within(examList).findByRole("option", {
        name: /数学テスト.*成績算出『期末成績』が使うため/,
      })

      await user.click(selectAllOf(dialog, "試験"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          roots: { Exam: ["exam-2"], Grade: ["grade-1"] },
          exclusions: {},
        })
      )
      await user.click(selectAllOf(dialog, "試験"))
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          roots: { Grade: ["grade-1"] },
          exclusions: {},
        })
      )
    })
  })

  describe("学級から生徒を選ぶ", () => {
    /** 学級から選ぶ生徒の時期のボタン（開いている間はメニューの外が aria-hidden になる） */
    const phaseButton = (dialog: HTMLElement) =>
      within(dialog).getByRole("button", {
        name: "選んだ学級から選ぶ生徒",
        hidden: true,
      })

    /** プルダウンを開いて時期を付け外しし、閉じる */
    const togglePhases = async (
      user: ReturnType<typeof userEvent.setup>,
      dialog: HTMLElement,
      labels: string[]
    ) => {
      await user.click(phaseButton(dialog))
      for (const label of labels) {
        await user.click(
          await screen.findByRole("menuitemcheckbox", { name: label })
        )
      }
      await user.keyboard("{Escape}")
    }

    /** 学級を選ぶ（学級の一覧の行をクリック） */
    const pickClassroom = async (
      user: ReturnType<typeof userEvent.setup>,
      dialog: HTMLElement
    ) =>
      user.click(
        await within(await findKindList(dialog, "学級")).findByRole("option", {
          name: /1年1組/,
        })
      )

    it("既定は在籍中・在籍予定。時期を変えると選んである学級にさかのぼって効き、何も選ばなければ入らない", async () => {
      const user = userEvent.setup()
      previewExport.mockResolvedValue(okPreview())
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      const studentList = await findKindList(dialog, "生徒")
      expect(phaseButton(dialog)).toHaveTextContent("在籍中ほか1")

      await pickClassroom(user, dialog)
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          shared: { Classroom: ["classroom-1"], Student: ["student-1"] },
        })
      )
      expect(
        within(studentList).getByRole("option", {
          name: /山田 太郎.*選択中（1年1組）/,
        })
      ).toBeInTheDocument()

      await togglePhases(user, dialog, ["過去在籍"])
      expect(phaseButton(dialog)).toHaveTextContent("すべて")
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          shared: {
            Classroom: ["classroom-1"],
            Student: ["student-1", "student-2"],
          },
        })
      )

      // 過去在籍だけ: 在籍中の山田は入らず、過去在籍の佐藤だけ
      await togglePhases(user, dialog, ["在籍中", "在籍予定"])
      expect(phaseButton(dialog)).toHaveTextContent("過去在籍")
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          shared: { Classroom: ["classroom-1"], Student: ["student-2"] },
        })
      )

      // 在籍予定だけ: 1年1組に在籍予定の生徒はいない
      await togglePhases(user, dialog, ["過去在籍", "在籍予定"])
      expect(phaseButton(dialog)).toHaveTextContent("在籍予定")
      await waitFor(() =>
        expect(lastPreviewSelection()?.shared).toEqual({
          Classroom: ["classroom-1"],
        })
      )

      // 何も選ばない
      await togglePhases(user, dialog, ["在籍予定"])
      expect(phaseButton(dialog)).toHaveTextContent("生徒を選ばない")
      expect(lastPreviewSelection()?.shared).toEqual({
        Classroom: ["classroom-1"],
      })
    })

    /** 下見: 選んだ生徒と学級がそのまま入る（main の範囲の規則の写し。学級は生徒を引き上げない） */
    const mockPreviewOfShared = () =>
      previewExport.mockImplementation(
        (selection: { shared?: Record<string, string[]> }) =>
          Promise.resolve(
            okPreview({
              entityIds: {
                ...EMPTY_ENTITY_IDS,
                Exam: ["exam-1"],
                Student: selection.shared?.Student ?? [],
                Classroom: selection.shared?.Classroom ?? [],
              },
            })
          )
      )

    it("選んだ学級に当てると、その学級から入った生徒が赤枠になり、件数が出る", async () => {
      const user = userEvent.setup()
      mockPreviewOfShared()
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      const studentList = await findKindList(dialog, "生徒")
      const classroomList = await findKindList(dialog, "学級")

      await togglePhases(user, dialog, ["過去在籍"])
      await pickClassroom(user, dialog)
      await within(studentList).findByRole("option", {
        name: /佐藤 花子.*選択中（1年1組）/,
      })

      const classroomOption = within(classroomList).getByRole("option", {
        name: /1年1組.*選択中/,
      })
      await user.hover(classroomOption)
      expect(
        await within(classroomOption).findByText("2件の選択を解除")
      ).toBeInTheDocument()
      expect(
        within(studentList).getAllByRole("option", {
          name: new RegExp(LOST_TEXT),
        })
      ).toHaveLength(2)
    })

    it("学級から入った生徒を1人外すときも、外した選択から学級の生徒を求め直して下見する", async () => {
      const user = userEvent.setup()
      mockPreviewOfShared()
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      const studentList = await findKindList(dialog, "生徒")

      await pickClassroom(user, dialog)
      const yamadaOption = await within(studentList).findByRole("option", {
        name: /山田 太郎.*選択中（1年1組）/,
      })
      await user.hover(yamadaOption)
      // 山田を外した選択（学級は残る・山田は外した生徒）で下見する
      await waitFor(() =>
        expect(
          previewExport.mock.calls.some(
            ([selection]) =>
              JSON.stringify(selection.shared) ===
              JSON.stringify({ Classroom: ["classroom-1"] })
          )
        ).toBe(true)
      )
    })

    it("1人ずつ外した生徒は、切り替えや学級の付け外しで戻らない。自分でチェックし直せば戻る", async () => {
      const user = userEvent.setup()
      previewExport.mockResolvedValue(okPreview())
      const dialog = renderDialog({ roots: { Exam: ["exam-1"] } })
      const studentList = await findKindList(dialog, "生徒")

      await togglePhases(user, dialog, ["過去在籍"])
      await pickClassroom(user, dialog)
      await user.click(
        await within(studentList).findByRole("option", {
          name: /佐藤 花子.*選択中（1年1組）/,
        })
      )
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          shared: { Classroom: ["classroom-1"], Student: ["student-1"] },
        })
      )

      // 時期を付け外ししても戻らない
      await togglePhases(user, dialog, ["過去在籍"])
      await togglePhases(user, dialog, ["過去在籍"])
      // 学級を外して付け直しても戻らない
      await pickClassroom(user, dialog)
      await waitFor(() => expect(lastPreviewSelection()?.shared).toEqual({}))
      await pickClassroom(user, dialog)
      await waitFor(() =>
        expect(lastPreviewSelection()?.shared).toEqual({
          Classroom: ["classroom-1"],
          Student: ["student-1"],
        })
      )

      // 自分でチェックし直せば戻る
      await user.click(
        within(studentList).getByRole("option", { name: /佐藤 花子/ })
      )
      await waitFor(() =>
        expect(lastPreviewSelection()).toMatchObject({
          shared: {
            Classroom: ["classroom-1"],
            Student: ["student-1", "student-2"],
          },
        })
      )
    })
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

    const examList = await findKindList(dialog, "試験")
    await user.click(
      await within(examList).findByRole("option", {
        name: /数学テスト.*関連で入る/,
      })
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
