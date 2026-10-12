import { column, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const AI_TYPES = "src/types/aiGrading.types.ts"

export const AI_GRADING_TERM_IDS = [
  "aiGrading",
  "aiPrompt",
  "aiGradingRun",
  "aiGradingAttempt",
  "aiConfidence",
  "aiRubricProposal",
  "aiQuestioning",
  "aiCheck",
] as const
export type AiGradingTermId = (typeof AI_GRADING_TERM_IDS)[number]

export const AI_GRADING_CATEGORY: GlossaryCategory<AiGradingTermId> = {
  id: "aiGrading",
  termIds: AI_GRADING_TERM_IDS,
  codeRefs: {
    aiGrading: [table("AiGradingRun"), table("AiGradingAttempt")],
    aiPrompt: [
      table("AiPrompt"),
      column("AiPrompt", "rubricText"),
      table("AiPromptQuestionImage"),
    ],
    aiGradingRun: [
      table("AiGradingRun"),
      column("AiGradingRun", "purpose"),
      column("AiGradingRun", "mode"),
    ],
    aiGradingAttempt: [
      table("AiGradingAttempt"),
      column("AiGradingAttempt", "state"),
      column("AiGradingAttempt", "status"),
    ],
    aiConfidence: [column("AiGradingAttempt", "confidence")],
    aiRubricProposal: [
      table("AiRubricProposal"),
      table("AiRubricProposalOption"),
      table("AiRubricProposalResponse"),
    ],
    aiQuestioning: [
      table("AiRubricProposalResponse"),
      table("AiAttemptResponse"),
    ],
    aiCheck: [
      value("AiGradingRun", "purpose", "check", AI_TYPES),
      table("AiAttemptResponse"),
    ],
  },
}
