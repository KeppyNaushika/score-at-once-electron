/**
 * 用語集の、言語に依存しない側をまとめる（語の id・並び・指す実体）。
 *
 * **画面の語と、それが指す表・列・値・コードの識別子の対応を、ここに集める。** 新しい機能の
 * 名前を決めるとき、既存の語と重ならないかを grep で探さずに済むようにする（#1465）。
 *
 * 語は分類ごとに `categories/*.ts` に書く。語の呼び名・説明は言語ごとの文言の側
 * （`text/ja/*.ts`）に置き、ここには持たない。型の約束は `types.ts`。
 */

import {
  AI_GRADING_CATEGORY,
  type AiGradingTermId,
} from "./categories/aiGradingCategory"
import {
  ANSWER_SHEET_BUILDER_CATEGORY,
  type AnswerSheetBuilderTermId,
} from "./categories/answerSheetBuilderCategory"
import {
  CLASSROOM_CATEGORY,
  type ClassroomTermId,
} from "./categories/classroomCategory"
import {
  COURSEWORK_CATEGORY,
  type CourseworkTermId,
} from "./categories/courseworkCategory"
import { DATA_CATEGORY, type DataTermId } from "./categories/dataCategory"
import {
  EXAM_SETUP_CATEGORY,
  type ExamSetupTermId,
} from "./categories/examSetupCategory"
import {
  FINALIZE_EXPORT_CATEGORY,
  type FinalizeExportTermId,
} from "./categories/finalizeExportCategory"
import { GRADE_CATEGORY, type GradeTermId } from "./categories/gradeCategory"
import {
  SCORING_CATEGORY,
  type ScoringTermId,
} from "./categories/scoringCategory"
import {
  STUDENT_CATEGORY,
  type StudentTermId,
} from "./categories/studentCategory"
import { TAG_CATEGORY, type TagTermId } from "./categories/tagCategory"
import { USER_CATEGORY, type UserTermId } from "./categories/userCategory"
import type { GlossaryCategory, GlossaryCodeRef, GlossaryTerm } from "./types"

export type GlossaryTermId =
  | UserTermId
  | ClassroomTermId
  | StudentTermId
  | TagTermId
  | ExamSetupTermId
  | ScoringTermId
  | FinalizeExportTermId
  | AiGradingTermId
  | CourseworkTermId
  | GradeTermId
  | AnswerSheetBuilderTermId
  | DataTermId

/** 分類1つを、画面に並べる語へ開く */
const expandCategory = <TermId extends GlossaryTermId>(
  glossaryCategory: GlossaryCategory<TermId>
): GlossaryTerm[] =>
  glossaryCategory.termIds.map((termId) => ({
    id: termId,
    categoryId: glossaryCategory.id,
    codeRefs: glossaryCategory.codeRefs[termId],
  }))

/**
 * 全部の語（並び順どおり）。分類の並びは `GLOSSARY_CATEGORY_IDS` と同じにする。
 * 分類ごとに開くのは、分類ごとに語の id の型が違い、まとめて開くと型が追えないため
 */
export const GLOSSARY_TERMS: GlossaryTerm[] = [
  ...expandCategory(USER_CATEGORY),
  ...expandCategory(CLASSROOM_CATEGORY),
  ...expandCategory(STUDENT_CATEGORY),
  ...expandCategory(TAG_CATEGORY),
  ...expandCategory(EXAM_SETUP_CATEGORY),
  ...expandCategory(SCORING_CATEGORY),
  ...expandCategory(FINALIZE_EXPORT_CATEGORY),
  ...expandCategory(AI_GRADING_CATEGORY),
  ...expandCategory(COURSEWORK_CATEGORY),
  ...expandCategory(GRADE_CATEGORY),
  ...expandCategory(ANSWER_SHEET_BUILDER_CATEGORY),
  ...expandCategory(DATA_CATEGORY),
]

export const GLOSSARY_TERM_IDS: readonly GlossaryTermId[] = GLOSSARY_TERMS.map(
  (glossaryTerm) => glossaryTerm.id
)

const GLOSSARY_TERM_ID_SET: ReadonlySet<string> = new Set(GLOSSARY_TERM_IDS)

export const isGlossaryTermId = (text: string): text is GlossaryTermId =>
  GLOSSARY_TERM_ID_SET.has(text)

/** 画面で見せる名前（`CropRegion.scoringMethod = "points"` の形） */
export function codeRefName(codeRef: GlossaryCodeRef): string {
  switch (codeRef.kind) {
    case "table":
      return codeRef.model
    case "column":
      return `${codeRef.model}.${codeRef.field}`
    case "value":
      return `${codeRef.model}.${codeRef.field} = "${codeRef.value}"`
    case "identifier":
      return codeRef.name
  }
}
