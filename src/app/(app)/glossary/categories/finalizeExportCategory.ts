import { column, identifier, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const OVERLAY_TYPES = "src/types/scoringOverlay.types.ts"

export const FINALIZE_EXPORT_TERM_IDS = [
  "scoreDecision",
  "scoreConflict",
  "decisionStale",
  "scoringMark",
  "answerOverlay",
  "individualReport",
  "returnSnapshot",
] as const
export type FinalizeExportTermId = (typeof FINALIZE_EXPORT_TERM_IDS)[number]

export const FINALIZE_EXPORT_CATEGORY: GlossaryCategory<FinalizeExportTermId> =
  {
    id: "finalizeExport",
    termIds: FINALIZE_EXPORT_TERM_IDS,
    codeRefs: {
      scoreDecision: [
        table("ScoreDecision"),
        column("ScoreDecision", "verdict"),
        column("ScoreDecision", "decidedByUserId"),
      ],
      scoreConflict: [
        identifier(
          "DecisionFilterSettings",
          "src/components/exams/08-finalize/types.ts"
        ),
      ],
      decisionStale: [column("ScoreDecision", "decidedAt")],
      scoringMark: [
        value("ExamAnswerOverlayStyle", "overlayKind", "mark", OVERLAY_TYPES),
        column("ExamAnswerOverlayVisibility", "showMark"),
      ],
      answerOverlay: [
        table("ExamAnswerOverlayStyle"),
        table("ExamAnswerOverlayVisibility"),
        identifier("OVERLAY_KINDS", OVERLAY_TYPES),
      ],
      individualReport: [
        table("ExamIndividualReportSettings"),
        table("ExamIndividualReportTableSection"),
      ],
      returnSnapshot: [table("ReturnSnapshot")],
    },
  }
