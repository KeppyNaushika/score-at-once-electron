// @vitest-environment jsdom
/**
 * 07 の採点指示の「助言の文案の指示」の初期値（docs/vlm-grading-design.md §3-1）。
 *
 * ここで固定すること:
 * - 新規追加では、「AI採点」の画面の「既定値」タブで決めた文言が最初から入り、そのまま保存される
 * - 元の採点指示を写して作るもの（「編集」）は、既定の文言ではなく元の値を引き継ぐ
 * - 既定値を読む前は新規追加を押せない（空欄で始まってしまうため）
 * - 選んだ採点指示は中身のどこを押しても（Enter・Space でも）編集が開く。問題の画像のサムネイルは拡大のまま
 *
 * window.electronAPI は偽物で、実データには触れない。
 */

import "../setup"

import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiPromptPanel } from "@/components/exams/07-score-at-once/AiGrading/AiPromptPanel"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  EXAM_PAGE_ID,
  makePrompt,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const DEFAULT_ANNOTATION_INSTRUCTION =
  "部分点の答案にだけ書く\n「です・ます」で、20字以内"

const SETTINGS: AiGradingSettings = {
  defaultProvider: "anthropic",
  defaultModels: { anthropic: "claude-opus-5-5", openai: "gpt-5.5" },
  defaultEffort: "medium",
  defaultMode: "realtime",
  concurrency: 4,
  budgetWarningUsd: null,
  openaiCompatibleBaseUrl: null,
  anthropicPricingSourceUrl: "https://example.test/pricing",
  openaiPricingSourceUrl: "https://example.test/openai-pricing",
  defaultAnnotationInstruction: DEFAULT_ANNOTATION_INSTRUCTION,
}

const cropRegion: QuestionAnswerRegionRow = {
  id: CROP_REGION_ID,
  examPageId: EXAM_PAGE_ID,
  label: "1-(1)",
  type: "QUESTION_ANSWER",
  x: 0.1,
  y: 0.1,
  width: 0.5,
  height: 0.2,
  points: 4,
  orderIndex: 0,
  scoringMethod: "points",
  scoreScaleId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  examPage: {
    id: EXAM_PAGE_ID,
    examId: "exam-1",
    pageNumber: 1,
    imagePath: "master/page1.png",
    pageSize: "A4",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  cropSubtotals: [],
}

/** main の代わり。作った採点指示は id だけ返す */
function installFakeElectronApi() {
  const aiGrading = {
    createPrompt: vi.fn(async () => ({ id: "prompt-created" })),
    listPrompts: vi.fn(async () => []),
  }
  const answerSheetBuilder = { listDefinitions: vi.fn(async () => []) }
  Object.defineProperty(window, "electronAPI", {
    value: { aiGrading, answerSheetBuilder },
    writable: true,
    configurable: true,
  })
  return aiGrading
}

function renderPanel(options: {
  settings: AiGradingSettings | undefined
  prompts?: ReturnType<typeof makePrompt>[]
  selectedPromptId?: string | null
  onRunWithPrompt?: (promptId: string, purpose: "grade" | "check") => void
}) {
  const prompts = options.prompts ?? []
  render(
    <AiPromptPanel
      examId="exam-1"
      cropRegion={cropRegion}
      prompts={prompts}
      promptNumberById={
        new Map(prompts.map((prompt, index) => [prompt.id, index + 1]))
      }
      selectedPromptId={options.selectedPromptId ?? null}
      onSelectPrompt={vi.fn()}
      onRunWithPrompt={options.onRunWithPrompt ?? vi.fn()}
      settings={options.settings}
    />,
    { wrapper: createQueryWrapper() }
  )
}

describe("採点指示の助言の文案の指示の初期値", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("新規追加では既定の文言が最初から入り、そのまま保存される", async () => {
    const user = userEvent.setup()
    const aiGrading = installFakeElectronApi()
    renderPanel({ settings: SETTINGS })

    await user.click(screen.getByRole("button", { name: "新規追加" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("助言の文案の指示")).toHaveValue(
      DEFAULT_ANNOTATION_INSTRUCTION
    )

    await user.click(within(dialog).getByRole("button", { name: "保存" }))
    expect(aiGrading.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        parentPromptId: null,
        annotationInstruction: DEFAULT_ANNOTATION_INSTRUCTION,
      })
    )
  })

  it("既定の文言が未設定なら、新規追加は空欄から始まる", async () => {
    const user = userEvent.setup()
    installFakeElectronApi()
    renderPanel({ settings: { ...SETTINGS, defaultAnnotationInstruction: "" } })

    await user.click(screen.getByRole("button", { name: "新規追加" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("助言の文案の指示")).toHaveValue("")
  })

  it("元の採点指示を写して作るものは、既定の文言ではなく元の値を引き継ぐ（空でも上書きしない）", async () => {
    const user = userEvent.setup()
    const aiGrading = installFakeElectronApi()
    const basePrompt = makePrompt({ annotationInstruction: "" })
    renderPanel({
      settings: SETTINGS,
      prompts: [basePrompt],
      selectedPromptId: basePrompt.id,
    })

    await user.click(screen.getByRole("button", { name: "指示 1 を編集" }))
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByLabelText("助言の文案の指示")).toHaveValue("")

    await user.click(
      within(dialog).getByRole("button", { name: "新しい採点指示として保存" })
    )
    expect(aiGrading.createPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        parentPromptId: basePrompt.id,
        annotationInstruction: "",
      })
    )
  })

  it("既定値を読む前は、新規追加を押せない", () => {
    installFakeElectronApi()
    renderPanel({ settings: undefined })

    expect(screen.getByRole("button", { name: "新規追加" })).toBeDisabled()
  })

  it("選んだ採点指示は中身のどこを押しても編集が開き、問題の画像のサムネイルは拡大だけ開く", async () => {
    const user = userEvent.setup()
    installFakeElectronApi()
    const prompt = makePrompt({
      questionImages: [
        {
          id: "question-image-1",
          promptId: "prompt-1",
          imagePath: "ai-question-images/1.png",
          sortOrder: 0,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        },
      ],
    })
    renderPanel({
      settings: SETTINGS,
      prompts: [prompt],
      selectedPromptId: prompt.id,
    })
    expect(screen.queryByRole("button", { name: "編集" })).toBeNull()

    await user.click(
      screen.getByRole("button", { name: "問題の画像 1枚目を拡大" })
    )
    const zoom = await screen.findByRole("dialog")
    expect(within(zoom).queryByRole("heading", { name: /を編集/ })).toBeNull()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    const editTarget = screen.getByRole("button", { name: "指示 1 を編集" })
    const expectEditorOpened = async () => {
      const editor = await screen.findByRole("dialog")
      expect(
        within(editor).getByRole("heading", { name: /^指示 1 を編集/ })
      ).toBeInTheDocument()
      await user.keyboard("{Escape}")
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    }

    // 中身の文字（見出し）を押しても開く
    await user.click(within(editTarget).getByText("採点基準"))
    await expectEditorOpened()

    // 焦点を当てて Enter・Space でも開く
    editTarget.focus()
    await user.keyboard("{Enter}")
    await expectEditorOpened()
    editTarget.focus()
    await user.keyboard(" ")
    await expectEditorOpened()
  })
})

describe("採点指示からの実行", () => {
  it("選んだ採点指示の下に「AI 採点を実行」と「AI チェックを実行」があり、それぞれの目的で開く", async () => {
    const user = userEvent.setup()
    installFakeElectronApi()
    const prompt = makePrompt()
    const onRunWithPrompt = vi.fn()
    renderPanel({
      settings: SETTINGS,
      prompts: [prompt],
      selectedPromptId: prompt.id,
      onRunWithPrompt,
    })

    await user.click(screen.getByRole("button", { name: "AI 採点を実行" }))
    expect(onRunWithPrompt).toHaveBeenLastCalledWith(prompt.id, "grade")
    await user.click(screen.getByRole("button", { name: "AI チェックを実行" }))
    expect(onRunWithPrompt).toHaveBeenLastCalledWith(prompt.id, "check")
  })
})
