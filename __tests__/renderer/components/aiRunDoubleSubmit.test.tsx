// @vitest-environment jsdom
/**
 * 外部へ送るボタンのダブルクリック（07 の AI 採点）。
 *
 * ここで固定すること:
 * - 実行ダイアログの「送信」を2回続けて押しても、startRun は1回しか呼ばれない
 *   （`isPending` が画面に反映される前の2回目の押下も止める）
 * - 押したら、結果を待たずにダイアログを閉じる。成功・失敗はトーストで知らせる
 * - 閉じて開き直せば、また押せる
 *
 * window.electronAPI は偽物で、ネットワークにも実際のキーにも実データにも触れない。
 */

import "../setup"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { type ReactNode, useState } from "react"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AiGradingRunDialog } from "@/components/exams/07-score-at-once/AiGrading/AiGradingRunDialog"
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
  scoringMethod: "points",
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
      questionImages: [],
      modelAnswerImage: null,
    })),
    startRun: vi.fn(async (): Promise<{ id: string }> => ({ id: "run-new" })),
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

interface DialogHarnessProps {
  onOpenChange: (open: boolean) => void
}

/** 閉じたら外れ、ボタンで開き直せる実行ダイアログ（呼び出し側と同じ持ち方） */
function RunDialogHarness({ onOpenChange }: DialogHarnessProps) {
  const [isOpen, setIsOpen] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        実行ダイアログを開く
      </button>
      <AiGradingRunDialog
        purpose="grade"
        open={isOpen}
        onOpenChange={(open) => {
          onOpenChange(open)
          setIsOpen(open)
        }}
        examId="exam-1"
        cropRegion={cropRegion}
        settings={SETTINGS}
        initialProvider="anthropic"
        unlockedProviders={["anthropic"]}
        prompt={makePrompt()}
        reviewedAnswers={[
          reviewed(makeAnswer("s1")),
          reviewed(makeAnswer("s2")),
        ]}
        questionScores={[]}
        currentUserId={CURRENT_USER_ID}
        selectedExamStudentIds={new Set()}
      />
    </>
  )
}

/** 送信の確認まで進め、送信のボタンを返す */
async function advanceToRunConfirmation() {
  await userEvent.click(screen.getByRole("button", { name: "送信の確認へ" }))
  return screen.getByRole("button", { name: "Anthropic へ送信する" })
}

describe("実行ダイアログの送信", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ダブルクリックしても startRun は1回だけ。押したら結果を待たずに閉じ、成功はトーストで知らせる", async () => {
    const aiGrading = installFakeElectronApi()
    const deferredRun = createDeferred<{ id: string }>()
    aiGrading.startRun.mockImplementationOnce(() => deferredRun.promise)
    const onOpenChange = vi.fn()
    renderWithProviders(<RunDialogHarness onOpenChange={onOpenChange} />)
    const sendButton = await advanceToRunConfirmation()

    // 描画を挟まずに2回押す（ダブルクリック）
    fireEvent.click(sendButton)
    fireEvent.click(sendButton)

    expect(onOpenChange).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Anthropic へ送信する" })
      ).toBeNull()
    )
    expect(aiGrading.startRun).toHaveBeenCalledTimes(1)
    expect(toast.success).not.toHaveBeenCalled()

    deferredRun.resolve({ id: "run-new" })
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(
        "2件の答案を Anthropic へ送りました"
      )
    )
    expect(aiGrading.startRun).toHaveBeenCalledTimes(1)
  })

  it("失敗したら、閉じた後でもトーストで分かる", async () => {
    const aiGrading = installFakeElectronApi()
    aiGrading.startRun.mockRejectedValueOnce(new Error("つながりません"))
    const onOpenChange = vi.fn()
    renderWithProviders(<RunDialogHarness onOpenChange={onOpenChange} />)
    const sendButton = await advanceToRunConfirmation()

    fireEvent.click(sendButton)

    expect(onOpenChange).toHaveBeenCalledWith(false)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "AI 採点を始められませんでした",
        { description: "つながりません" }
      )
    )
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("閉じて開き直せば、また押せる", async () => {
    const aiGrading = installFakeElectronApi()
    aiGrading.startRun.mockRejectedValueOnce(new Error("つながりません"))
    renderWithProviders(<RunDialogHarness onOpenChange={vi.fn()} />)

    fireEvent.click(await advanceToRunConfirmation())
    await waitFor(() => expect(toast.error).toHaveBeenCalled())

    await userEvent.click(
      screen.getByRole("button", { name: "実行ダイアログを開く" })
    )
    const sendButtonAgain = await advanceToRunConfirmation()
    expect(sendButtonAgain).toBeEnabled()
    fireEvent.click(sendButtonAgain)

    await waitFor(() => expect(aiGrading.startRun).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1))
  })
})
