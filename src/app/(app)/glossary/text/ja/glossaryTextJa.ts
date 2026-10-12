/**
 * 用語集の日本語の文言。言語に依存しない側（語の id・指す実体）は `glossaryTerms.ts`。
 *
 * 別の言語を足すときは、この形（`GlossaryText`）のものを `text/<言語>/` にもう1組作る。
 * 語の呼び名は、その言語の画面に出ている語をそのまま書く（用語集が画面と食い違うと、
 * 用語集の意味が無い）。
 */

import type { GlossaryText } from "../../types"
import { AI_GRADING_TEXT_JA } from "./aiGradingTextJa"
import { ANSWER_SHEET_BUILDER_TEXT_JA } from "./answerSheetBuilderTextJa"
import { CLASSROOM_TEXT_JA } from "./classroomTextJa"
import { COURSEWORK_TEXT_JA } from "./courseworkTextJa"
import { DATA_TEXT_JA } from "./dataTextJa"
import { EXAM_SETUP_TEXT_JA } from "./examSetupTextJa"
import { FINALIZE_EXPORT_TEXT_JA } from "./finalizeExportTextJa"
import { GRADE_TEXT_JA } from "./gradeTextJa"
import { SCORING_TEXT_JA } from "./scoringTextJa"
import { STUDENT_TEXT_JA } from "./studentTextJa"
import { TAG_TEXT_JA } from "./tagTextJa"
import { USER_TEXT_JA } from "./userTextJa"

export const GLOSSARY_TEXT_JA: GlossaryText = {
  ui: {
    title: "用語集",
    subtitle: "画面の語と、それが指す表・列・値・コードの識別子",
    searchPlaceholder: "語・別の表記・表や列の名前で絞り込む",
    noMatch: "当てはまる語がありません",
    variants: "別の表記",
    avoidedAliases: "使わない語",
    distinctions: "似た語との違い",
    index: "索引",
    termCount: (count) => `${count}語`,
    copied: (name) => `${name} をコピーしました`,
    copyHint: "押すと名前をコピーします",
  },
  groups: {
    user: "ユーザー",
    classroom: "学級",
    student: "生徒",
    tag: "タグ",
    exam: "試験",
    coursework: "試験外成績資料",
    grade: "成績算出",
    answerSheetBuilder: "解答用紙作成",
    data: "データ・同期・設定",
  },
  categories: {
    user: "ユーザー",
    classroom: "学級",
    student: "生徒",
    tag: "タグ",
    examSetup: "準備（1〜6）",
    scoring: "採点（7）",
    finalizeExport: "採点確定・結果（8・9）",
    coursework: "試験外成績資料",
    grade: "成績算出",
    answerSheetBuilder: "解答用紙作成",
    aiGrading: "AI採点",
    data: "データ・同期・設定",
  },
  codeRefKinds: {
    table: "表",
    column: "列",
    value: "値",
    identifier: "型",
  },
  terms: {
    ...USER_TEXT_JA,
    ...CLASSROOM_TEXT_JA,
    ...STUDENT_TEXT_JA,
    ...TAG_TEXT_JA,
    ...EXAM_SETUP_TEXT_JA,
    ...SCORING_TEXT_JA,
    ...FINALIZE_EXPORT_TEXT_JA,
    ...AI_GRADING_TEXT_JA,
    ...COURSEWORK_TEXT_JA,
    ...GRADE_TEXT_JA,
    ...ANSWER_SHEET_BUILDER_TEXT_JA,
    ...DATA_TEXT_JA,
  },
}
