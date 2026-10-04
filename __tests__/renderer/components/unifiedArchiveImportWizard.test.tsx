// @vitest-environment jsdom
/**
 * 統合アーカイブ（.sao）の取り込みウィザードの検証。
 *
 * window.electronAPI.unifiedArchive をモックして、段の遷移・開けなかったときの表示・
 * 紐づけの選択肢（利用者に「取り込まない」が無い、別で追加でアーカイブの id を選べない）・
 * 解けない衝突で取り込めないことを確かめる。
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

import { UnifiedArchiveImportWizard } from "@/components/unified-archive/import/UnifiedArchiveImportWizard"
import { createAppQueryClient } from "@/queries/queryClient"

const unifiedArchive = {
  selectImportFile: vi.fn(),
  open: vi.fn(),
  analyze: vi.fn(),
  import: vi.fn(),
  close: vi.fn(),
}

const manifest = {
  format: "score-at-once-archive",
  formatVersion: 1,
  appVersion: "1.2.3",
  lastMigration: "20261004000000_x",
  exportedAt: "2026-10-01T09:00:00.000Z",
  exportedByUserId: "user-a",
  selection: {
    roots: { Exam: ["exam-1"] },
    shared: {},
    scoring: { kind: "self", userId: "user-a" },
    includeAnswers: true,
    optionalItems: [],
  },
  exclusions: {
    requested: {},
    excludedRowCounts: { QuestionScore: 4 },
  },
  rowCounts: { Exam: 1, Student: 2, User: 1, QuestionScore: 10 },
  files: { count: 0, missing: [] },
}

const studentCandidate = {
  table: "Student",
  archiveId: "student-archive",
  archiveRow: {
    id: "student-archive",
    lastName: "山田",
    firstName: "太郎",
    lastNameKana: "ヤマダ",
    firstNameKana: "タロウ",
    studentNumber: "1001",
  },
  matchedBy: "studentNumber",
  candidates: [
    {
      existingId: "student-existing",
      existingRow: {
        id: "student-existing",
        lastName: "山田",
        firstName: "太郎",
        lastNameKana: "ヤマダ",
        firstNameKana: "タロウ",
        studentNumber: "1001",
      },
    },
  ],
}

const userCandidate = {
  table: "User",
  archiveId: "user-archive",
  archiveRow: { id: "user-archive", name: "佐藤", username: "sato" },
  matchedBy: "username",
  candidates: [
    {
      existingId: "user-existing",
      existingRow: { id: "user-existing", name: "佐藤", username: "sato" },
    },
  ],
}

const openedResult = {
  kind: "opened",
  sessionId: "session-1",
  manifest,
  appliedMigrations: [],
  migratedRowCounts: {},
  matchCandidates: [studentCandidate, userCandidate],
  suggestedDecisions: {
    "Student:student-archive": {
      kind: "same",
      existingId: "student-existing",
      adoptId: "existing",
    },
    "User:user-archive": {
      kind: "same",
      existingId: "user-existing",
      adoptId: "existing",
    },
  },
}

const emptyGradeImpactSource = {
  referencedRows: [],
  exams: [],
  courseworks: [],
  subtotals: [],
  gradeItems: [],
  students: [],
  classrooms: [],
}

const okAnalysis = (uniqueConflicts: unknown[] = []) => ({
  kind: "ok",
  result: {
    action: "merge",
    counts: {
      Exam: { created: 1, replaced: 0, kept: 0, skipped: 0 },
      Student: { created: 0, replaced: 0, kept: 1, skipped: 0 },
    },
    uniqueConflicts,
    renamedIds: [],
    idMap: {},
    warnings: [],
    filePaths: { written: [], kept: [] },
  },
  gradeInputChanges: [],
  gradeImpactSource: emptyGradeImpactSource,
})

const tagConflict = {
  table: "Tag",
  columns: ["name"],
  archiveId: "tag-archive",
  existingId: "tag-existing",
  archiveRow: { id: "tag-archive", name: "中間" },
  existingRow: { id: "tag-existing", name: "中間" },
  migrated: true,
  resolution: "existing",
}

beforeAll(() => {
  // Radix の Select が jsdom で開くのに要る（jsdom は持たない）
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => {}
  Element.prototype.scrollIntoView = () => {}
})

beforeEach(() => {
  for (const mockFunction of Object.values(unifiedArchive)) {
    mockFunction.mockReset()
  }
  unifiedArchive.selectImportFile.mockResolvedValue("/tmp/test.sao")
  unifiedArchive.open.mockResolvedValue(openedResult)
  unifiedArchive.analyze.mockResolvedValue(okAnalysis())
  unifiedArchive.import.mockResolvedValue({
    ...okAnalysis(),
    files: {
      copied: ["a.png"],
      replaced: [],
      skipped: [],
      unreferenced: [],
      failed: [],
    },
  })
  unifiedArchive.close.mockResolvedValue(undefined)
  Object.defineProperty(window, "electronAPI", {
    value: { unifiedArchive },
    writable: true,
    configurable: true,
  })
})

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

function renderWizard(
  handlers: {
    onOpenChange?: (open: boolean) => void
    onComplete?: () => void
  } = {}
) {
  return render(
    <UnifiedArchiveImportWizard
      open
      onOpenChange={handlers.onOpenChange ?? (() => {})}
      onComplete={handlers.onComplete}
    />,
    { wrapper: Wrapper }
  )
}

const clickNext = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByRole("button", { name: "次へ" }))

/** Radix の Select をキーボードで開き、出た選択肢の名前を返す */
async function optionNamesOf(
  user: ReturnType<typeof userEvent.setup>,
  trigger: HTMLElement
): Promise<string[]> {
  trigger.focus()
  await user.keyboard("{Enter}")
  const listbox = await screen.findByRole("listbox")
  const optionNames = within(listbox)
    .getAllByRole("option")
    .map((option) => option.textContent ?? "")
  await user.keyboard("{Escape}")
  return optionNames
}

async function openArchive(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /ファイルを選択/ }))
  await screen.findByText("ファイルの内容")
}

describe("UnifiedArchiveImportWizard", () => {
  it("UA-I1: ファイル選択から実行まで段を進め、完了で onComplete を呼ぶ", async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    renderWizard({ onComplete })

    await openArchive(user)
    expect(unifiedArchive.open).toHaveBeenCalledWith({
      archivePath: "/tmp/test.sao",
    })
    // 内容確認: manifest と、含まれていないもの
    expect(screen.getByText("1.2.3")).toBeInTheDocument()
    expect(screen.getByText("採点 4行")).toBeInTheDocument()
    expect(
      screen.getByText(
        "他の教員の採点・確定・返却版（本人分だけを書き出しています）"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("監査ログ")).toBeInTheDocument()

    await clickNext(user)
    expect(await screen.findByText("データの紐づけ")).toBeInTheDocument()

    await clickNext(user)
    expect(await screen.findByText("衝突はありません")).toBeInTheDocument()
    expect(unifiedArchive.analyze).toHaveBeenCalledWith({
      sessionId: "session-1",
      action: "merge",
      decisions: {
        conflictIdChoice: "existing",
        conflictIdOverrides: {},
        matches: openedResult.suggestedDecisions,
      },
    })

    await clickNext(user)
    expect(await screen.findByText("取り込む内容の確認")).toBeInTheDocument()
    // 決定が変わっていないので試し取り込みはやり直さない
    expect(unifiedArchive.analyze).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole("button", { name: /取り込む/ }))
    expect(
      await screen.findByText("取り込みが完了しました")
    ).toBeInTheDocument()
    expect(unifiedArchive.import).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("UA-I2: 開けなかったら理由を日本語で出し、ファイル選択に留まる", async () => {
    const user = userEvent.setup()
    unifiedArchive.open.mockResolvedValue({
      kind: "rejected",
      reason: "newerSchema",
      details: ["20991231000000_future"],
    })
    renderWizard()

    await user.click(screen.getByRole("button", { name: /ファイルを選択/ }))

    expect(
      await screen.findByText(
        "新しいバージョンのアプリで書き出されています。アプリを更新してから開いてください。"
      )
    ).toBeInTheDocument()
    expect(screen.getByText("20991231000000_future")).toBeInTheDocument()
    expect(screen.getByText("統合アーカイブを選択")).toBeInTheDocument()
  })

  it("UA-I3: 利用者には「取り込まない」を出さない（生徒には出す）", async () => {
    const user = userEvent.setup()
    renderWizard()
    await openArchive(user)
    await clickNext(user)
    await screen.findByText("データの紐づけ")

    const studentOptions = await optionNamesOf(
      user,
      screen.getByRole("combobox", { name: "山田 太郎 (1001)の扱い" })
    )
    expect(studentOptions).toContain("取り込まない")

    await user.click(screen.getByRole("tab", { name: /利用者/ }))
    const userOptions = await optionNamesOf(
      user,
      await screen.findByRole("combobox", { name: "佐藤（sato）の扱い" })
    )
    expect(userOptions).toEqual(["同じものとして紐づける", "新しく登録する"])
  })

  it("UA-I4: 別で追加ではアーカイブの id を選ばせず、衝突は既存の行に合わせる", async () => {
    const user = userEvent.setup()
    unifiedArchive.analyze.mockResolvedValue(okAnalysis([tagConflict]))
    renderWizard()
    await openArchive(user)
    await user.click(screen.getByLabelText(/別で追加する/))
    await clickNext(user)
    await screen.findByText("データの紐づけ")

    expect(
      screen.queryByRole("combobox", { name: "山田 太郎 (1001)の id" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/このパソコンの id に合わせます/)
    ).toBeInTheDocument()

    await clickNext(user)
    expect(await screen.findByText("既存の行に合わせます")).toBeInTheDocument()
    expect(screen.queryByText("採用する id（一括）")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("combobox", { name: "タグの採用する id" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/は版をまたいで同じものかを id で判断できません/)
    ).toBeInTheDocument()
    expect(unifiedArchive.analyze).toHaveBeenCalledWith(
      expect.objectContaining({ action: "separate" })
    )
  })

  it("UA-I5: 上書き・統合では衝突の id を一括と1件ずつで選べる", async () => {
    const user = userEvent.setup()
    unifiedArchive.analyze.mockResolvedValue(okAnalysis([tagConflict]))
    renderWizard()
    await openArchive(user)
    await clickNext(user)
    await clickNext(user)

    expect(await screen.findByText("採用する id（一括）")).toBeInTheDocument()
    await user.click(screen.getByLabelText(/アーカイブの id に合わせる/))
    await clickNext(user)
    await screen.findByText("取り込む内容の確認")

    expect(unifiedArchive.analyze).toHaveBeenLastCalledWith(
      expect.objectContaining({
        decisions: expect.objectContaining({ conflictIdChoice: "archive" }),
      })
    )
  })

  it("UA-I6: 解けない衝突があれば理由を出し、取り込めない", async () => {
    const user = userEvent.setup()
    unifiedArchive.analyze.mockResolvedValue({
      kind: "unresolvable",
      reasons: [
        {
          kind: "sharedExisting",
          table: "Student",
          columns: [],
          archiveIds: ["a", "b"],
          existingIds: ["c"],
        },
      ],
    })
    renderWizard()
    await openArchive(user)
    await clickNext(user)
    await clickNext(user)
    await clickNext(user)
    await screen.findByText("取り込む内容の確認")

    expect(
      screen.getByText(/複数の行が、このパソコンの同じ1行に寄せられます/)
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /取り込む/ })).toBeDisabled()
    expect(unifiedArchive.import).not.toHaveBeenCalled()
  })

  it("UA-I8: 確認の段に、値が変わる成績算出と評価項目を出し、確定済みには強い注意を添える", async () => {
    const user = userEvent.setup()
    const grade = { id: "grade-1", name: "後学期" }
    const knowledgeItem = {
      id: "item-1",
      name: "知識",
      order: 0,
      grade,
      frozenScores: [{ id: "frozen-1" }],
    }
    unifiedArchive.analyze.mockResolvedValue({
      ...okAnalysis(),
      gradeInputChanges: [
        {
          table: "GradeItemBoundary",
          id: "boundary-1",
          before: null,
          after: { id: "boundary-1", gradeItemId: "item-1", label: "A" },
        },
      ],
      gradeImpactSource: {
        ...emptyGradeImpactSource,
        gradeItems: [knowledgeItem],
      },
    })
    renderWizard()
    await openArchive(user)
    await clickNext(user)
    await clickNext(user)
    await clickNext(user)
    await screen.findByText("取り込む内容の確認")

    const section = screen.getByRole("region", { name: "成績算出への影響" })
    expect(
      within(section).getByText("この取り込みで値が変わる成績算出")
    ).toBeInTheDocument()
    expect(within(section).getByText("後学期")).toBeInTheDocument()
    expect(within(section).getByText(/知識/)).toHaveTextContent(
      "知識（確定済み）"
    )
    expect(within(section).getByRole("alert")).toHaveTextContent(
      /確定した値のまま変わりません/
    )
  })

  it("UA-I9: 値が変わる成績算出が無ければ、変わらないと出す", async () => {
    const user = userEvent.setup()
    renderWizard()
    await openArchive(user)
    await clickNext(user)
    await clickNext(user)
    await clickNext(user)
    await screen.findByText("取り込む内容の確認")

    expect(
      screen.getByRole("region", { name: "成績算出への影響" })
    ).toHaveTextContent("成績算出の値は変わりません。")
  })

  it("UA-I7: 取り込まずに閉じたら main の作業を閉じる", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = renderWizard({ onOpenChange })
    await openArchive(user)

    await user.click(screen.getByRole("button", { name: "キャンセル" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    rerender(
      <UnifiedArchiveImportWizard open={false} onOpenChange={onOpenChange} />
    )

    await waitFor(() =>
      expect(unifiedArchive.close).toHaveBeenCalledWith({
        sessionId: "session-1",
      })
    )
  })
})
