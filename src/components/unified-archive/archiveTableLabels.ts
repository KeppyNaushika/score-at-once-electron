/**
 * 統合アーカイブ（.sao）の画面で、DB の表名・列名を日本語で見せるためのラベル
 *
 * main は表名・列名をそのまま返す（文言は renderer が作る）。書き出しダイアログと
 * 取り込みウィザードの両方がここを引く。載っていない名前はそのまま出す（表を足しても
 * 画面が壊れないように）。
 */

const ARCHIVE_TABLE_LABELS: Readonly<Record<string, string>> = {
  User: "利用者",
  Classroom: "学級",
  Student: "生徒",
  StudentClassroomMembership: "在籍",
  Exam: "試験",
  ExamStudent: "受験生徒",
  ExamPage: "模範解答ページ",
  StudentAnswerImage: "答案画像",
  CropRegion: "採点枠",
  CropRegionAssignment: "採点の担当",
  SubtotalGroup: "小計グループ",
  Subtotal: "小計",
  CropSubtotal: "採点枠の小計",
  UserExam: "試験のメンバー",
  ExamSubtotalGroup: "試験の小計グループ",
  QuestionScore: "採点",
  ScoreDecision: "採点の確定",
  DrawingAnnotation: "注釈",
  ReturnSnapshot: "返却版",
  AuditLog: "操作履歴",
  AuditLogTarget: "操作履歴の対象",
  ExamClassroom: "試験の学級",
  Tag: "タグ",
  TagSubtotalGroup: "小計グループのタグ",
  ExamTag: "試験のタグ",
  AsbDefinitionTag: "解答用紙定義のタグ",
  UserKeyboardShortcut: "キーボードショートカット",
  AppPreference: "組織の設定",
  UserPreference: "利用者の設定",
  UserScoringStatusColor: "採点状態の色",
  UserClickScoringAction: "クリック採点の割り当て",
  UserSidePanelSection: "サイドパネルの並び",
  ExamAnswerOverlayStyle: "答案の重ね表示の見た目",
  ExamAnswerOverlayVisibility: "答案の重ね表示の表示",
  ExamIndividualReportSettings: "個票の設定",
  ExamIndividualReportTableSection: "個票の表",
  ExamIndividualReportStatisticVisibility: "個票の統計の表示",
  ExamIndividualReportGraphSettings: "個票のグラフ",
  CropRegionOmrConfig: "マークシートの設定",
  CropRegionOmrChoiceOption: "マークシートの選択肢",
  CompoundAnswer: "複合解答",
  CompoundAnswerMember: "複合解答の採点枠",
  CompoundAnswerScore: "複合解答の採点",
  Grade: "成績算出",
  GradeTag: "成績算出のタグ",
  GradeConstraint: "観点間の制約",
  GradeConstraintViewpoint: "制約の観点",
  GradeConstraintLabelValue: "制約の評価値",
  GradeConstraintExclusionLabel: "制約の除外評価",
  GradeItem: "評価項目",
  GradeComparison: "比較",
  GradeClassroom: "成績算出の学級",
  GradeStudent: "成績算出の生徒",
  GradeDataSource: "データソース",
  GradeDataSourceEstimationSource: "見込みの元",
  GradeItemExclusion: "評価の除外",
  GradeOverride: "評価の上書き",
  GradeFrozenScore: "確定した評価",
  GradeItemBoundary: "成績境界",
  GradeIndividualReportSettings: "成績の個票の設定",
  Coursework: "資料",
  CourseworkClassroom: "資料の学級",
  CourseworkStudent: "資料の生徒",
  CourseworkTag: "資料のタグ",
  CourseworkItem: "資料の項目",
  CourseworkScore: "資料の点数",
  CourseworkLetterScale: "資料の評価段階",
  AsbDefinition: "解答用紙定義",
  AsbHeaderField: "解答用紙のヘッダー欄",
  AsbMajorQuestion: "解答用紙の大問",
  AsbSubQuestion: "解答用紙の小問",
  AsbBranchQuestion: "解答用紙の枝問",
  AsbTextElement: "解答用紙の文字",
  AsbImageElement: "解答用紙の画像",
  AsbOmrConfig: "解答用紙のマーク欄",
  AsbOmrChoiceOption: "解答用紙のマーク選択肢",
  AsbManuscriptPaper: "解答用紙の原稿用紙",
  AsbCharGuide: "解答用紙の字数ガイド",
  AiPrompt: "AI採点のプロンプト",
  AiGradingRun: "AI採点の実行",
  AiGradingAttempt: "AI採点の判定",
}

/** 表名の日本語ラベル。載っていなければ表名のまま */
export function archiveTableLabel(table: string): string {
  return ARCHIVE_TABLE_LABELS[table] ?? table
}

/**
 * 一意キーに出てくる列の日本語ラベル。`…Id` の列は参照先の表のラベルを使う
 * （`examStudentId` → 受験生徒）
 */
const ARCHIVE_COLUMN_LABELS: Readonly<Record<string, string>> = {
  name: "名前",
  key: "キー",
  label: "評価値",
  action: "操作",
  status: "状態",
  clickCount: "クリック回数",
  sectionId: "セクション",
  overlayKind: "重ね表示の種類",
  tableKind: "表の種類",
  statisticKind: "統計の種類",
  scope: "範囲",
  choiceIndex: "選択肢の番号",
  assignmentType: "割り当ての種類",
  username: "利用者名",
  studentNumber: "学籍番号",
  lastName: "姓",
  firstName: "名",
}

/** 列名の先頭を大文字にして表名の形にする（`examStudent` → `ExamStudent`） */
const toTableName = (columnStem: string): string =>
  columnStem.charAt(0).toUpperCase() + columnStem.slice(1)

/** 参照先の表名が列名から素直に引けない `…Id` 列 */
const REFERENCE_COLUMN_TABLES: Readonly<Record<string, string>> = {
  omrConfigId: "CropRegionOmrConfig",
  constraintId: "GradeConstraint",
  dataSourceId: "GradeDataSource",
  sourceDataSourceId: "GradeDataSource",
  comparedGradeItemId: "GradeItem",
  subQuestionId: "AsbSubQuestion",
  branchQuestionId: "AsbBranchQuestion",
}

/** 列名の日本語ラベル。載っていなければ列名のまま */
export function archiveColumnLabel(column: string): string {
  const columnLabel = ARCHIVE_COLUMN_LABELS[column]
  if (columnLabel) return columnLabel
  if (column.endsWith("Id")) {
    const referencedTable =
      REFERENCE_COLUMN_TABLES[column] ?? toTableName(column.slice(0, -2))
    const tableLabel = ARCHIVE_TABLE_LABELS[referencedTable]
    if (tableLabel) return tableLabel
  }
  return column
}
