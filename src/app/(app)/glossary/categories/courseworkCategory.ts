import { column, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

export const COURSEWORK_TERM_IDS = [
  "coursework",
  "courseworkReferenceDate",
  "courseworkClassroom",
  "courseworkStudent",
  "courseworkItem",
  "courseworkItemMaxScore",
  "courseworkInputNumeric",
  "courseworkInputLetter",
  "courseworkScore",
  "courseworkScoreAdjustment",
  "courseworkLetterScale",
  "customOrder",
] as const
export type CourseworkTermId = (typeof COURSEWORK_TERM_IDS)[number]

export const COURSEWORK_CATEGORY: GlossaryCategory<CourseworkTermId> = {
  id: "coursework",
  termIds: COURSEWORK_TERM_IDS,
  codeRefs: {
    coursework: [table("Coursework"), column("Coursework", "name")],
    courseworkReferenceDate: [column("Coursework", "referenceDate")],
    courseworkClassroom: [table("CourseworkClassroom")],
    courseworkStudent: [table("CourseworkStudent")],
    courseworkItem: [table("CourseworkItem"), column("CourseworkItem", "name")],
    courseworkItemMaxScore: [column("CourseworkItem", "maxScore")],
    courseworkInputNumeric: [
      value(
        "CourseworkItem",
        "inputMode",
        "numeric",
        "src/types/coursework.types.ts"
      ),
    ],
    courseworkInputLetter: [
      value(
        "CourseworkItem",
        "inputMode",
        "letter",
        "src/types/coursework.types.ts"
      ),
      column("CourseworkScore", "letterValue"),
    ],
    courseworkScore: [
      table("CourseworkScore"),
      column("CourseworkScore", "score"),
    ],
    courseworkScoreAdjustment: [
      column("CourseworkScore", "adjustment"),
      column("CourseworkScore", "adjustmentReason"),
    ],
    courseworkLetterScale: [
      table("CourseworkLetterScale"),
      column("CourseworkLetterScale", "label"),
    ],
    customOrder: [
      column("GradeStudent", "customOrder"),
      column("CourseworkStudent", "customOrder"),
    ],
  },
}
