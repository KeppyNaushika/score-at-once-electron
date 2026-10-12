import { column, identifier, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const RUBRIC_TYPES = "src/types/rubric.types.ts"
const SCORING_STATUS_TYPES = "src/types/scoringStatus.types.ts"
const SCORING_VIEW_TYPES = "src/components/exams/07-score-at-once/types.ts"

export const SCORING_TERM_IDS = [
  "questionScore",
  "scoringStatus",
  "statusUnscored",
  "statusCorrect",
  "statusPartial",
  "statusPending",
  "statusIncorrect",
  "statusNoAnswer",
  "statusDoubleMark",
  "statusEvaluated",
  "partialScore",
  "scoringKeys",
  "scoreComment",
  "scoringMethod",
  "scoringMethodPoints",
  "scoringMethodDeduction",
  "scoringMethodAddition",
  "scoringMethodScale",
  "incompatibleScore",
  "rubricItem",
  "rubricItemReason",
  "rubricAdjust",
  "rubricSet",
  "rubricApplication",
  "manualOverride",
  "rubricAdvice",
  "rubricAdviceCombination",
  "scoreScale",
  "scoreScaleLevel",
  "scoreScaleLevelDescription",
  "scoreScaleLevelScore",
  "drawingAnnotation",
  "gridView",
  "individualView",
  "scoringInputMode",
  "clickScoring",
  "scoringStatusColor",
] as const
export type ScoringTermId = (typeof SCORING_TERM_IDS)[number]

const statusValue = (storedValue: string) =>
  value("QuestionScore", "status", storedValue, SCORING_STATUS_TYPES)
const scoringMethodValue = (storedValue: string) =>
  value("CropRegion", "scoringMethod", storedValue, RUBRIC_TYPES)

export const SCORING_CATEGORY: GlossaryCategory<ScoringTermId> = {
  id: "scoring",
  termIds: SCORING_TERM_IDS,
  codeRefs: {
    questionScore: [
      table("QuestionScore"),
      column("QuestionScore", "userId"),
      column("QuestionScore", "examStudentId"),
      column("QuestionScore", "cropRegionId"),
    ],
    scoringStatus: [
      column("QuestionScore", "status"),
      identifier("ScoringStatus", SCORING_STATUS_TYPES),
      identifier("SCORING_STATUS_LABELS", "src/lib/scoringStatusColors.ts"),
    ],
    statusUnscored: [statusValue("unscored")],
    statusCorrect: [statusValue("correct")],
    statusPartial: [statusValue("partial")],
    statusPending: [statusValue("pending")],
    statusIncorrect: [statusValue("incorrect")],
    statusNoAnswer: [statusValue("no_answer")],
    statusDoubleMark: [statusValue("double_mark")],
    statusEvaluated: [
      statusValue("evaluated"),
      column("QuestionScore", "scaleLevelId"),
    ],
    partialScore: [
      column("QuestionScore", "partialScore"),
      column("ScoreDecision", "score"),
    ],
    scoringKeys: [
      table("UserKeyboardShortcut"),
      identifier("DEFAULT_KEYBINDINGS", "src/lib/scoringKeybindings.ts"),
    ],
    scoreComment: [
      column("QuestionScore", "comment"),
      column("ScoreDecision", "comment"),
    ],
    scoringMethod: [
      column("CropRegion", "scoringMethod"),
      identifier("ScoringMethod", RUBRIC_TYPES),
    ],
    scoringMethodPoints: [scoringMethodValue("points")],
    scoringMethodDeduction: [scoringMethodValue("deduction")],
    scoringMethodAddition: [scoringMethodValue("addition")],
    scoringMethodScale: [
      scoringMethodValue("scale"),
      column("CropRegion", "scoreScaleId"),
    ],
    incompatibleScore: [
      identifier("isStatusCompatibleWithScoringMethod", RUBRIC_TYPES),
    ],
    rubricItem: [table("RubricItem"), column("RubricItem", "effectKind")],
    rubricItemReason: [column("RubricItem", "label")],
    rubricAdjust: [
      value("RubricItem", "effectKind", "adjust", RUBRIC_TYPES),
      column("RubricItem", "pointDelta"),
    ],
    rubricSet: [
      value("RubricItem", "effectKind", "set", RUBRIC_TYPES),
      column("RubricItem", "setStatus"),
      column("RubricItem", "setScore"),
    ],
    rubricApplication: [table("RubricApplication")],
    manualOverride: [column("QuestionScore", "overridesRubric")],
    rubricAdvice: [
      column("RubricItem", "adviceText"),
      column("DrawingAnnotation", "isRubricAdvice"),
    ],
    rubricAdviceCombination: [
      table("RubricAdviceCombination"),
      column("RubricAdviceCombination", "mode"),
    ],
    scoreScale: [table("ScoreScale"), column("ScoreScale", "examId")],
    scoreScaleLevel: [
      table("ScoreScaleLevel"),
      column("ScoreScaleLevel", "label"),
    ],
    scoreScaleLevelDescription: [column("ScoreScaleLevel", "description")],
    scoreScaleLevelScore: [column("ScoreScaleLevel", "score")],
    drawingAnnotation: [
      table("DrawingAnnotation"),
      column("DrawingAnnotation", "type"),
    ],
    gridView: [identifier("GradingMode", SCORING_VIEW_TYPES)],
    individualView: [identifier("GradingMode", SCORING_VIEW_TYPES)],
    scoringInputMode: [],
    clickScoring: [
      table("UserClickScoringAction"),
      identifier("ClickScoringAction", "src/types/clickScoring.types.ts"),
    ],
    scoringStatusColor: [table("UserScoringStatusColor")],
  },
}
