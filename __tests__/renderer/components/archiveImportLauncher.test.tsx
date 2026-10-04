// @vitest-environment jsdom
/**
 * 一覧の「読み込み」の振り分け（docs/unified-archive-design.md §7.6）。
 *
 * ファイル選択（main）が返す種類で、開く取り込み画面が決まることを確かめる。
 * 取り込み画面そのものは差し替え、どの画面が・どの始まりで開いたかだけを見る
 * （各画面の中身は、それぞれのテストが見る）。
 *
 * - .sao → 統合版のウィザード（開いた結果から始まる）
 * - .score → 試験の取り込み（読んで「内容確認」から始まる）、.hsz/.dat → 試験の取り込み（免責事項から）
 * - .coursework → 資料の取り込み、.grade → 成績算出の取り込み、.students → 生徒の取り込み
 * - .asb → 画面を挟まずに取り込む
 * - 知らない拡張子・読めないファイル → 画面を開かずに知らせる
 */

import "../setup"

import { QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ArchiveImportScreens } from "@/components/archive-import/ArchiveImportScreens"
import { archiveImportToolbarAction } from "@/components/archive-import/archiveImportToolbarAction"
import { useArchiveImportLauncher } from "@/components/archive-import/hooks/useArchiveImportLauncher"
import { createAppQueryClient } from "@/queries/queryClient"

vi.mock("@/contexts/CurrentUserContext", () => ({
  useCurrentUser: () => ({ id: "user-1", username: "teacher", name: "教員" }),
}))

// 取り込み画面は差し替える。開いた画面と、渡された始まりを文字で出す
vi.mock(
  "@/components/unified-archive/import/UnifiedArchiveImportWizard",
  () => ({
    UnifiedArchiveImportWizard: ({
      startWith,
    }: {
      startWith?: { kind: string }
    }) => <div data-testid="screen">unified:{startWith?.kind}</div>,
  })
)
vi.mock("@/components/import/ImportWizardModal", () => ({
  ImportWizardModal: ({
    startState,
  }: {
    startState?: {
      currentStep: string
      archivePath: string | null
      showHszDisclaimer?: boolean
      hszOriginalPath?: string
    }
  }) => (
    <div data-testid="screen">
      exam:{startState?.currentStep}:
      {startState?.archivePath ?? startState?.hszOriginalPath}:
      {startState?.showHszDisclaimer ? "disclaimer" : "no-disclaimer"}
    </div>
  ),
}))
vi.mock("@/components/student-import/StudentImportWizardModal", () => ({
  StudentImportWizardModal: ({
    startState,
  }: {
    startState?: { currentStep: string; archivePath: string | null }
  }) => (
    <div data-testid="screen">
      students:{startState?.currentStep}:{startState?.archivePath}
    </div>
  ),
}))
vi.mock("@/components/archive-import/CourseworkImportDialog", () => ({
  CourseworkImportDialog: ({ archivePath }: { archivePath: string }) => (
    <div data-testid="screen">coursework:{archivePath}</div>
  ),
}))
vi.mock("@/components/archive-import/GradeImportDialog", () => ({
  GradeImportDialog: ({ archivePath }: { archivePath: string }) => (
    <div data-testid="screen">grade:{archivePath}</div>
  ),
}))

const electronAPI = {
  unifiedArchive: {
    selectAnyImportFile: vi.fn(),
    open: vi.fn(),
  },
  archive: {
    analyzeArchive: vi.fn(),
    preMatch: vi.fn(),
  },
  studentArchive: {
    analyzeArchive: vi.fn(),
    preMatch: vi.fn(),
  },
  coursework: {
    analyzeArchive: vi.fn(),
  },
  grade: {
    analyzeArchive: vi.fn(),
  },
  answerSheetBuilder: {
    importDefinition: vi.fn(),
  },
}

beforeEach(() => {
  for (const api of Object.values(electronAPI)) {
    for (const mockFunction of Object.values(api)) mockFunction.mockReset()
  }
  vi.mocked(toast.error).mockClear()
  vi.mocked(toast.success).mockClear()
  electronAPI.unifiedArchive.open.mockResolvedValue({
    kind: "opened",
    sessionId: "session-1",
  })
  electronAPI.archive.analyzeArchive.mockResolvedValue({
    manifest: { examName: "期末試験" },
  })
  electronAPI.archive.preMatch.mockResolvedValue({ student: { byId: [] } })
  electronAPI.studentArchive.analyzeArchive.mockResolvedValue({})
  electronAPI.studentArchive.preMatch.mockResolvedValue({})
  electronAPI.coursework.analyzeArchive.mockResolvedValue({ matches: [] })
  electronAPI.grade.analyzeArchive.mockResolvedValue({ courseworkMatches: [] })
  electronAPI.answerSheetBuilder.importDefinition.mockResolvedValue({
    warnings: [],
  })
  Object.defineProperty(window, "electronAPI", {
    value: electronAPI,
    writable: true,
    configurable: true,
  })
})

/** 一覧と同じ置き方（ツールバーの「読み込み」と取り込み画面） */
function ListWithImport() {
  const launcher = useArchiveImportLauncher()
  const action = archiveImportToolbarAction({
    priority: 70,
    isOpening: launcher.isOpening,
    onClick: () => void launcher.start(),
  })
  return (
    <>
      {action.node}
      <ArchiveImportScreens launcher={launcher} />
    </>
  )
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={createAppQueryClient()}>
      {children}
    </QueryClientProvider>
  )
}

/** 「読み込み」を押して、指定のファイルを選んだことにする */
async function chooseFile(selected: { path: string; kind: string | null }) {
  electronAPI.unifiedArchive.selectAnyImportFile.mockResolvedValue(selected)
  render(<ListWithImport />, { wrapper: Wrapper })
  await userEvent.click(screen.getByRole("button", { name: "読み込み" }))
}

describe("「読み込み」の振り分け", () => {
  it("ボタンは1つで、名前は「読み込み」", () => {
    render(<ListWithImport />, { wrapper: Wrapper })
    expect(screen.getByRole("button", { name: "読み込み" })).toBeInTheDocument()
  })

  it(".sao は統合版のウィザードを、開いた結果から始める", async () => {
    await chooseFile({ path: "/tmp/a.sao", kind: "sao" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "unified:opened"
    )
    expect(electronAPI.unifiedArchive.open).toHaveBeenCalledWith({
      archivePath: "/tmp/a.sao",
    })
  })

  it(".sao が開けなかったときも、理由を見せるために統合版のウィザードを開く", async () => {
    electronAPI.unifiedArchive.open.mockResolvedValue({
      kind: "rejected",
      reason: "notArchive",
      details: [],
    })
    await chooseFile({ path: "/tmp/a.sao", kind: "sao" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "unified:rejected"
    )
  })

  it(".score は試験の取り込みを、読んだうえで「内容確認」から始める", async () => {
    await chooseFile({ path: "/tmp/a.score", kind: "score" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "exam:file_overview:/tmp/a.score:no-disclaimer"
    )
    expect(electronAPI.archive.analyzeArchive).toHaveBeenCalledWith({
      archivePath: "/tmp/a.score",
    })
    expect(electronAPI.archive.preMatch).toHaveBeenCalledWith({
      archivePath: "/tmp/a.score",
    })
  })

  it.each(["hsz", "dat"])(
    ".%s は試験の取り込みを、変換の前の免責事項から始める",
    async (kind) => {
      await chooseFile({ path: `/tmp/a.${kind}`, kind })
      expect(await screen.findByTestId("screen")).toHaveTextContent(
        `exam:file_select:/tmp/a.${kind}:disclaimer`
      )
      // 承認するまで変換も読み込みもしない
      expect(electronAPI.archive.analyzeArchive).not.toHaveBeenCalled()
    }
  )

  it(".coursework は資料の取り込みを開く", async () => {
    await chooseFile({ path: "/tmp/a.coursework", kind: "coursework" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "coursework:/tmp/a.coursework"
    )
    expect(electronAPI.coursework.analyzeArchive).toHaveBeenCalledWith({
      archivePath: "/tmp/a.coursework",
    })
  })

  it(".grade は成績算出の取り込みを開く", async () => {
    await chooseFile({ path: "/tmp/a.grade", kind: "grade" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "grade:/tmp/a.grade"
    )
    expect(electronAPI.grade.analyzeArchive).toHaveBeenCalledWith(
      "/tmp/a.grade"
    )
  })

  it(".students は生徒の取り込みを、読んだうえで「内容確認」から始める", async () => {
    await chooseFile({ path: "/tmp/a.students", kind: "students" })
    expect(await screen.findByTestId("screen")).toHaveTextContent(
      "students:file_overview:/tmp/a.students"
    )
  })

  it(".asb は画面を挟まずに、今の利用者の解答用紙として取り込む", async () => {
    await chooseFile({ path: "/tmp/a.asb", kind: "asb" })
    await waitFor(() =>
      expect(
        electronAPI.answerSheetBuilder.importDefinition
      ).toHaveBeenCalledWith("/tmp/a.asb", "user-1")
    )
    expect(toast.success).toHaveBeenCalledWith("解答用紙を読み込みました")
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument()
  })

  it("知らない拡張子は、画面を開かずに知らせる", async () => {
    await chooseFile({ path: "/tmp/a.txt", kind: null })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "このファイルは読み込めません",
        expect.anything()
      )
    )
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument()
  })

  it("読めなかったファイルは、画面を開かずに理由を知らせる", async () => {
    electronAPI.archive.analyzeArchive.mockRejectedValue(
      new Error("アーカイブを展開できません")
    )
    await chooseFile({ path: "/tmp/broken.score", kind: "score" })
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "ファイルを読み込めませんでした",
        {
          description: "アーカイブを展開できません",
        }
      )
    )
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument()
  })

  it("選ばずに閉じたら何も開かない", async () => {
    electronAPI.unifiedArchive.selectAnyImportFile.mockResolvedValue(null)
    render(<ListWithImport />, { wrapper: Wrapper })
    await userEvent.click(screen.getByRole("button", { name: "読み込み" }))
    await waitFor(() =>
      expect(electronAPI.unifiedArchive.selectAnyImportFile).toHaveBeenCalled()
    )
    expect(screen.queryByTestId("screen")).not.toBeInTheDocument()
    expect(toast.error).not.toHaveBeenCalled()
  })
})
