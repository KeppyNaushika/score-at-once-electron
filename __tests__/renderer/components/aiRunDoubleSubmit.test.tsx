// @vitest-environment jsdom
/**
 * 外部へ送るボタンのダブルクリック（07 の AI 採点）。
 *
 * ここで固定すること:
 * - 実行ダイアログの「送信」を2回続けて押しても、startRun は1回しか呼ばれない
 *   （`isPending` が画面に反映される前の2回目の押下も止める）。送信中は「送信中…」で押せない
 * - 送信に失敗したら、再び押せる（押せば送り直す）
 * - プロンプト修正の「修正を頼む」も同じく1回に限る
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
import { AiPromptRevisionDialog } from "@/components/exams/07-score-at-once/AiGrading/AiPromptRevisionDialog"
import type { AiGradingAnswer } from "@/components/exams/07-score-at-once/AiGrading/types"
import { reviewAnswer } from "@/components/exams/07-score-at-once/AiGrading/utils/answerReview"
import type { AiGradingSettings } from "@/electron-src/lib/aiGrading/providerCredentialStore"
import { AI_GRADING_CONSENT_VERSION } from "@/lib/shared/aiGrading/consentText"
import type { QuestionAnswerRegionRow } from "@/queries/cropRegion"

import { createQueryWrapper } from "../../helpers/queryWrapper"
import {
  CROP_REGION_ID,
  CURRENT_USER_ID,
  EXAM_PAGE_ID,
  makeAnswer,
  makePrompt,
} from "../aiGrading/helpers/aiGradingRowFixtures"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

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
  defaultAnnotationInstruction: "",
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

/** 外から解決・失敗させられる約束（送信中の状態を保つのに使う） */
function createDeferred<TResult>() {
  let resolvePromise: (result: TResult) => void = () => {}
  let rejectPromise: (error: Error) => void = () => {}
  const promise = new Promise<TResult>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

/** main の代わり。外部へ送る口は呼ばれたことだけを覚える */
function installFakeElectronApi() {
  const aiGrading = {
    estimateRun: vi.fn(async (input: { examStudentIds: string[] }) => ({
      answerImages: input.examStudentIds.map((examStudentId) => ({
        examStudentId,
        width: 750,
        height: 1000,
      })),
      questionImage: null,
      modelAnswerImage: null,
    })),
    startRun: vi.fn(async (): Promise<{ id: string }> => ({ id: "run-new" })),
    revisePrompt: vi.fn(async () => makePrompt({ id: "prompt-revised" })),
    listPrompts: vi.fn(async () => []),
    listRuns: vi.fn(async () => []),
    listRunsByExam: vi.fn(async () => []),
    listMyRuns: vi.fn(async () => []),
  }
  const aiProvider = {
    getStatuses: vi.fn(async () => [
      {
        provider: "anthropic",
        hasApiKey: true,
        isEncryptionAvailable: true,
        consent: {
          userId: CURRENT_USER_ID,
          consentVersion: AI_GRADING_CONSENT_VERSION,
          consentedAt: "2026-10-05T00:00:00.000Z",
        },
      },
    ]),
    getModelCatalogs: vi.fn(async () => ({ anthropic: null, openai: null })),
    getPricing: vi.fn(async () => ({
      modelPrices: [],
      batchPricePercents: { anthropic: null, openai: null },
    })),
  }
  Object.defineProperty(window, "electronAPI", {
    value: { aiGrading, aiProvider },
    writable: true,
    configurable: true,
  })
  return aiGrading
}

function renderWithProviders(children: ReactNode) {
  const QueryWrapper = createQueryWrapper()
  return render(<QueryWrapper>{children}</QueryWrapper>)
}

function reviewed(answer: AiGradingAnswer) {
  return {
    answer,
    review: reviewAnswer(answer, {
      chosenAttemptIdByExamStudentId: new Map(),
      selectedPromptId: "prompt-1",
      points: 4,
    }),
  }
}

/** 実行ダイアログを開き、答案を選んで送信の確認まで進める */
async function openRunConfirmation(onOpenChange: (open: boolean) => void) {
  renderWithProviders(
    <AiGradingRunDialog
      open
      onOpenChange={onOpenChange}
      examId="exam-1"
      cropRegion={cropRegion}
      settings={SETTINGS}
      initialProvider="anthropic"
      unlockedProviders={["anthropic"]}
      prompt={makePrompt()}
      reviewedAnswers={[reviewed(makeAnswer("s1")), reviewed(makeAnswer("s2"))]}
      questionScores={[]}
      currentUserId={CURRENT_USER_ID}
      selectedExamStudentIds={new Set()}
    />
  )
  await userEvent.click(screen.getByRole("radio", { name: "未採点のみ 2件" }))
  await userEvent.click(screen.getByRole("button", { name: "送信の確認へ" }))
  return screen.getByRole("button", { name: "Anthropic へ送信する" })
}

describe("実行ダイアログの送信", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ダブルクリックしても startRun は1回だけ。送信中は「送信中…」で押せず、成功したら閉じる", async () => {
    const aiGrading = installFakeElectronApi()
    const deferredRun = createDeferred<{ id: string }>()
    aiGrading.startRun.mockImplementationOnce(() => deferredRun.promise)
    const onOpenChange = vi.fn()
    const sendButton = await openRunConfirmation(onOpenChange)

    // 描画を挟まずに2回押す（ダブルクリック）
    fireEvent.click(sendButton)
    fireEvent.click(sendButton)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "送信中…" })).toBeDisabled()
    )
    expect(aiGrading.startRun).toHaveBeenCalledTimes(1)

    deferredRun.resolve({ id: "run-new" })
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(aiGrading.startRun).toHaveBeenCalledTimes(1)
  })

  it("失敗したら再び押せ、押せば送り直す", async () => {
    const aiGrading = installFakeElectronApi()
    aiGrading.startRun.mockRejectedValueOnce(new Error("つながりません"))
    const onOpenChange = vi.fn()
    const sendButton = await openRunConfirmation(onOpenChange)

    fireEvent.click(sendButton)
    fireEvent.click(sendButton)
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Anthropic へ送信する" })
      ).toBeEnabled()
    )
    expect(aiGrading.startRun).toHaveBeenCalledTimes(1)
    expect(onOpenChange).not.toHaveBeenCalledWith(false)

    await userEvent.click(
      screen.getByRole("button", { name: "Anthropic へ送信する" })
    )
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(aiGrading.startRun).toHaveBeenCalledTimes(2)
  })
})

describe("プロンプト修正の送信", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ダブルクリックしても revisePrompt は1回だけ", async () => {
    const aiGrading = installFakeElectronApi()
    renderWithProviders(
      <AiPromptRevisionDialog
        open
        onOpenChange={vi.fn()}
        examId="exam-1"
        cropRegion={cropRegion}
        basePrompt={makePrompt()}
        promptNumberById={new Map([["prompt-1", 1]])}
        provider="anthropic"
        settings={SETTINGS}
        reviewedAnswers={[]}
        selectedExamStudentIds={new Set()}
        onSelectPrompt={vi.fn()}
      />
    )
    await userEvent.type(
      screen.getByLabelText("指示"),
      "≡ と ＝ の区別で減点しないで"
    )
    const reviseButton = screen.getByRole("button", { name: "修正を頼む" })

    fireEvent.click(reviseButton)
    fireEvent.click(reviseButton)

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "この版を使う" })).toBeTruthy()
    )
    expect(aiGrading.revisePrompt).toHaveBeenCalledTimes(1)
  })
})
