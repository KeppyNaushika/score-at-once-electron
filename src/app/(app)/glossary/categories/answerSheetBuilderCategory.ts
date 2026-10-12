import { column, identifier, table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const ASB_TYPES = "src/types/answerSheetDefinition.types.ts"

export const ANSWER_SHEET_BUILDER_TERM_IDS = [
  "answerSheetDefinition",
  "examConversion",
  "asbHeaderField",
  "asbLinkedRegion",
  "asbMajorQuestion",
  "asbSubQuestion",
  "asbBranchQuestion",
  "asbTextElement",
  "asbImageElement",
  "asbOmrConfig",
  "omrMarker",
  "asbManuscriptPaper",
  "asbCharGuide",
  "verticalLayout",
  "multiColumn",
] as const
export type AnswerSheetBuilderTermId =
  (typeof ANSWER_SHEET_BUILDER_TERM_IDS)[number]

export const ANSWER_SHEET_BUILDER_CATEGORY: GlossaryCategory<AnswerSheetBuilderTermId> =
  {
    id: "answerSheetBuilder",
    termIds: ANSWER_SHEET_BUILDER_TERM_IDS,
    codeRefs: {
      answerSheetDefinition: [
        table("AsbDefinition"),
        column("AsbDefinition", "name"),
      ],
      examConversion: [table("AsbDefinition"), table("Exam")],
      asbHeaderField: [
        table("AsbHeaderField"),
        column("AsbHeaderField", "type"),
        identifier("HeaderFieldType", ASB_TYPES),
      ],
      asbLinkedRegion: [column("AsbHeaderField", "linkedRegionType")],
      asbMajorQuestion: [table("AsbMajorQuestion")],
      asbSubQuestion: [
        table("AsbSubQuestion"),
        column("AsbSubQuestion", "points"),
      ],
      asbBranchQuestion: [
        table("AsbBranchQuestion"),
        column("AsbSubQuestion", "usesBranchPoints"),
      ],
      asbTextElement: [table("AsbTextElement")],
      asbImageElement: [
        table("AsbImageElement"),
        column("AsbImageElement", "visibility"),
      ],
      asbOmrConfig: [table("AsbOmrConfig"), table("AsbOmrChoiceOption")],
      omrMarker: [column("AsbDefinition", "omrMarkersEnabled")],
      asbManuscriptPaper: [
        table("AsbManuscriptPaper"),
        column("AsbManuscriptPaper", "columns"),
        column("AsbManuscriptPaper", "rows"),
      ],
      asbCharGuide: [table("AsbCharGuide"), column("AsbCharGuide", "atChar")],
      verticalLayout: [column("AsbDefinition", "verticalLayout")],
      multiColumn: [
        column("AsbDefinition", "multiColumnEnabled"),
        column("AsbDefinition", "multiColumnCount"),
      ],
    },
  }
