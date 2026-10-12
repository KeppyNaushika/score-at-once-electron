/**
 * DB の表名（Prisma のモデル名）を、利用者に見せる日本語の呼び名へ直す。
 *
 * main からは表名しか渡ってこないが、利用者に見せる文面には日本語が要る。引くのは:
 *
 * - **同期のトースト・同期の警告・監査ログの要約** — かぶって隠れた行・表示に戻った行の表、
 *   親が削除されて表から外れた行の表と原因になった親の表
 * - **統合アーカイブ（.sao）の書き出しダイアログと取り込みウィザード** — 表ごとの件数・
 *   食い違いの一覧・一意キーの列名（`…Id` の列は参照先の表の呼び名）
 *
 * **同じ文言を main（監査ログの summary）と renderer（トースト・アーカイブの画面）の両方が
 * 組み立てる**ため、両側が値で引ける `src/lib/shared/` へ1つだけ置く（docs/coding-style.md
 * 「同じ結果を出す計算は `src/lib/shared/` へ」）。
 *
 * **schema.prisma の全モデルを載せる**（規約テスト `tableLabelCoverage` が縛る）。載せ漏れると
 * 「UserPreference 20件」のような英語の表名がそのまま画面に出る。呼び名は表名の直訳ではなく
 * 画面で見る言葉にする（issue #1492 の語の決定に従う）。
 */
export const TABLE_LABELS: Readonly<Record<string, string>> = {
  // 人・学級・タグ
  User: "ユーザー",
  Classroom: "学級",
  Student: "生徒",
  StudentClassroomMembership: "在籍",
  Tag: "タグ",

  // 試験
  Exam: "試験",
  ExamPage: "模範解答ページ",
  ExamStudent: "受験生徒",
  ExamClassroom: "試験の学級",
  ExamSubtotalGroup: "試験の小計点グループ",
  ExamTag: "試験のタグ",
  UserExam: "試験のメンバー",
  StudentAnswerImage: "答案画像",
  CropRegion: "採点領域",
  CropRegionAssignment: "設問ごとの採点担当",
  ExamStudentAssignment: "生徒ごとの採点担当",
  CropRegionOmrConfig: "OMR設定",
  CropRegionOmrChoiceOption: "OMRの選択肢",
  CompoundAnswer: "複合解答",
  CompoundAnswerMember: "複合解答の採点領域",
  CompoundAnswerScore: "複合解答の得点",
  QuestionScore: "採点",
  ScoreDecision: "採点確定",
  DrawingAnnotation: "注釈",
  ReturnSnapshot: "返却版",
  SubtotalGroup: "小計点グループ",
  Subtotal: "小計項目",
  CropSubtotal: "設問と小計項目の関連付け",
  TagSubtotalGroup: "小計点グループのタグ",
  ScoreScale: "類型表",
  ScoreScaleLevel: "類型",
  ExamAnswerOverlayStyle: "採点マークと点数の表示設定の見た目",
  ExamAnswerOverlayVisibility: "採点マークと点数の表示設定の表示の有無",
  ExamIndividualReportSettings: "試験採点結果個表の設定",
  ExamIndividualReportTableSection: "試験採点結果個表の表",
  ExamIndividualReportStatisticVisibility: "試験採点結果個表の統計の表示",
  ExamIndividualReportGraphSettings: "試験採点結果個表のグラフ",

  // AI採点・採点項目
  AiPrompt: "AI採点の採点指示",
  AiPromptQuestionImage: "AI採点の採点指示の問題の画像",
  AiGradingRun: "AI採点の実行",
  AiGradingAttempt: "AI採点の判定",
  AiAttemptRubricMatch: "AI採点の項目の当てはまり",
  AiAttemptResponse: "AI採点の判定への答え",
  AiRubricProposal: "AI採点の項目の案",
  AiRubricProposalOption: "AI採点の項目の案の選択肢",
  AiRubricProposalMember: "AI採点の項目の案の答案",
  AiRubricProposalResponse: "AI採点の項目の案への答え",
  AiRubricProposalResponseScore: "AI採点の項目の案への答えの得点",
  AiRubricProposalAdviceDraft: "AI採点の項目の案の助言の下書き",
  AiRubricProposalInstructionDraft: "AI採点の項目の案の再採点への指示の下書き",
  RubricItem: "採点項目",
  RubricApplication: "採点項目の適用",
  RubricAdviceCombination: "重なった助言の決まり",
  RubricAdviceCombinationItem: "重なった助言の決まりの項目",

  // 成績算出
  Grade: "成績算出",
  GradeTag: "成績算出のタグ",
  GradeItem: "成績評価項目",
  GradeItemBoundary: "成績境界",
  GradeClassroom: "成績算出の学級",
  GradeStudent: "成績算出の対象生徒",
  GradeDataSource: "データソース",
  GradeDataSourceEstimationSource: "推定に使うデータソース",
  GradeOverride: "上書き",
  GradeFrozenScore: "成績の固定",
  GradeItemExclusion: "成績評価項目の除外",
  GradeComparison: "比較",
  GradeExportComparison: "出力に載せる比較",
  GradeConstraint: "観点間の制約ルール",
  GradeConstraintViewpoint: "観点間の制約ルールの観点",
  GradeConstraintLabelValue: "観点間の制約ルールの成績評価記号の値",
  GradeConstraintExclusionLabel: "観点間の制約ルールの混在禁止の成績評価記号",
  GradeIndividualReportSettings: "個人成績通知書の設定",

  // 試験外成績資料
  Coursework: "試験外成績資料",
  CourseworkItem: "資料評価項目",
  CourseworkClassroom: "資料の学級",
  CourseworkStudent: "資料の対象生徒",
  CourseworkTag: "資料のタグ",
  CourseworkScore: "資料の得点",
  CourseworkLetterScale: "変換表",

  // 解答用紙
  AsbDefinition: "解答用紙",
  AsbDefinitionTag: "解答用紙のタグ",
  AsbHeaderField: "解答用紙の記入欄",
  AsbMajorQuestion: "解答用紙の大問",
  AsbSubQuestion: "解答用紙の小問",
  AsbBranchQuestion: "解答用紙の枝問",
  AsbTextElement: "解答用紙の文字",
  AsbImageElement: "解答用紙の画像",
  AsbOmrConfig: "マーク欄",
  AsbOmrChoiceOption: "マーク欄の選択肢",
  AsbManuscriptPaper: "解答用紙の原稿用紙",
  AsbCharGuide: "文字位置マーカー",

  // 設定（ユーザーごと／全員で共通）・操作履歴
  UserPreference: "ユーザーごとの設定",
  UserKeyboardShortcut: "ショートカットキー",
  UserScoringStatusColor: "採点状態の表示色",
  UserClickScoringAction: "クリック採点の設定",
  UserSidePanelSection: "サイドパネルの開閉",
  AppPreference: "全員で共通の設定",
  AuditLog: "操作履歴",
  AuditLogTarget: "操作履歴の対象",
}

/** 表名を日本語の呼び名にする。知らない表は表名をそのまま返す */
export const tableLabel = (tableName: string): string =>
  TABLE_LABELS[tableName] ?? tableName
