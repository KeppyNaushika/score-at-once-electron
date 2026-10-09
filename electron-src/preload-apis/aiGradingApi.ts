import type { AiGradingRunProgress } from "@/types/aiGrading.types"

import { bind } from "./invoke"
import { subscribe } from "./subscribe"

/**
 * AI 採点（VLM 採点）の IPC API（プロンプト・画像の測定・実行・採用）。
 *
 * 事業者の同意とキーの口は別の API にある。API キーを返すメソッドは無い。
 */
export function createAiGradingApi() {
  return {
    aiGrading: {
      listPrompts: bind("aiGrading:listPrompts"),
      createPrompt: bind("aiGrading:createPrompt"),
      getAsbModelAnswerSource: bind("aiGrading:getAsbModelAnswerSource"),
      previewCrop: bind("aiGrading:previewCrop"),
      estimateRun: bind("aiGrading:estimateRun"),
      startRun: bind("aiGrading:startRun"),
      cancelRun: bind("aiGrading:cancelRun"),
      listRuns: bind("aiGrading:listRuns"),
      listRunsByExam: bind("aiGrading:listRunsByExam"),
      listMyRuns: bind("aiGrading:listMyRuns"),
      deleteAttempts: bind("aiGrading:deleteAttempts"),
      adoptAttempts: bind("aiGrading:adoptAttempts"),

      /** 実行の進み具合（試行を1件書くたび）を購読する。外すのは戻り値を呼ぶ */
      onRunProgress: (callback: (progress: AiGradingRunProgress) => void) =>
        subscribe("aiGrading:run-progress", callback),
    },
  }
}
