import type { AiGradingRunProgress } from "@/types/aiGrading.types"

import { bind } from "./invoke"
import { subscribe } from "./subscribe"

/**
 * AI 採点（VLM 採点）の IPC API（プロンプト・画像の測定・実行・問いかけ）。
 *
 * 事業者の同意とキーの口は別の API にある。API キーを返すメソッドは無い。
 */
export function createAiGradingApi() {
  return {
    aiGrading: {
      listPrompts: bind("aiGrading:listPrompts"),
      createPrompt: bind("aiGrading:createPrompt"),
      importQuestionImage: bind("aiGrading:importQuestionImage"),
      discardQuestionImages: bind("aiGrading:discardQuestionImages"),
      getAsbModelAnswerSource: bind("aiGrading:getAsbModelAnswerSource"),
      estimateRun: bind("aiGrading:estimateRun"),
      startRun: bind("aiGrading:startRun"),
      startGroupingRun: bind("aiGrading:startGroupingRun"),
      cancelRun: bind("aiGrading:cancelRun"),
      listRuns: bind("aiGrading:listRuns"),
      listRunsByExam: bind("aiGrading:listRunsByExam"),
      listMyRuns: bind("aiGrading:listMyRuns"),
      listProposals: bind("aiGrading:listProposals"),
      recordProposalDraft: bind("aiGrading:recordProposalDraft"),
      setProposalAdviceDraft: bind("aiGrading:setProposalAdviceDraft"),
      setProposalInstructionDraft: bind(
        "aiGrading:setProposalInstructionDraft"
      ),
      discardProposalInstructionDrafts: bind(
        "aiGrading:discardProposalInstructionDrafts"
      ),
      recordAttemptResponses: bind("aiGrading:recordAttemptResponses"),
      setQuestioningScoringMethod: bind(
        "aiGrading:setQuestioningScoringMethod"
      ),
      commitProposalResponse: bind("aiGrading:commitProposalResponse"),
      writeQuestioningScores: bind("aiGrading:writeQuestioningScores"),
      markQuestioningCommitted: bind("aiGrading:markQuestioningCommitted"),

      /** 実行の進み具合（試行を1件書くたび）を購読する。外すのは戻り値を呼ぶ */
      onRunProgress: (callback: (progress: AiGradingRunProgress) => void) =>
        subscribe("aiGrading:run-progress", callback),
    },
  }
}
