/**
 * 同期の「畳み」で消えた行のテーブル名を、人が読む日本語へ直す。
 *
 * 畳みは NAS 同期が別id・同一ユニークキーの行を1つへまとめる操作で、ライブラリからは
 * テーブル名（Prisma のモデル名）しか渡ってこない。**同じ文言を main（監査ログの
 * summary）と renderer（トースト）の両方が組み立てる**ため、両側が値で引ける
 * `src/lib/shared/` へ1つだけ置く（docs/coding-style.md「同じ結果を出す計算は
 * `src/lib/shared/` へ」）。
 *
 * 載っているのは `id` 以外の unique を持つ表のうち、利用者が名前で分かるものだけ。
 * 網羅は狙わない（表は増え続けるので、載せ漏れを致命傷にしない）。載っていない表は
 * テーブル名をそのまま出す。
 */
const SYNC_FOLD_TABLE_LABELS: Record<string, string> = {
  User: "ユーザー",
  Classroom: "学級",
  Student: "生徒",
  Tag: "タグ",
  Subtotal: "小計点",
  ExamStudent: "試験の受験生徒",
  ExamClassroom: "試験の学級",
  ExamSubtotalGroup: "試験の小計点グループ",
  ExamTag: "試験のタグ",
  UserExam: "試験の担当者",
  StudentAnswerImage: "答案画像",
  CropRegionAssignment: "採点領域の担当割り当て",
  CropRegionOmrConfig: "採点領域のOMR設定",
  CropRegionOmrChoiceOption: "OMRの選択肢",
  CompoundAnswerMember: "複合解答の構成要素",
  CompoundAnswerScore: "複合解答の点数",
  ScoreDecision: "確定した点数",
  ReturnSnapshot: "返却版",
  TagSubtotalGroup: "タグと小計点グループの紐付け",
  AsbDefinitionTag: "解答用紙定義のタグ",
  GradeClassroom: "成績の学級",
  GradeStudent: "成績の生徒",
  GradeOverride: "成績の上書き",
  GradeFrozenScore: "確定した成績値",
  GradeItemExclusion: "評価項目の除外",
  GradeConstraintViewpoint: "観点間制約の観点",
  GradeConstraintLabelValue: "観点間制約の評語の値",
  GradeConstraintExclusionLabel: "観点間制約の除外評語",
  GradeDataSourceEstimationSource: "成績データソースの推定元",
  CourseworkClassroom: "試験外成績資料の学級",
  CourseworkStudent: "試験外成績資料の生徒",
  CourseworkTag: "試験外成績資料のタグ",
  CourseworkScore: "試験外成績資料の点数",
  CourseworkLetterScale: "試験外成績資料の評語",
}

/** テーブル名を日本語の呼び名にする。知らない表はテーブル名をそのまま返す */
export const syncFoldTableLabel = (tableName: string): string =>
  SYNC_FOLD_TABLE_LABELS[tableName] ?? tableName
