/**
 * 同期が知らせてくる出来事のテーブル名を、人が読む日本語へ直す。
 *
 * ライブラリからはテーブル名（Prisma のモデル名）しか渡ってこないが、利用者に見せる
 * 文面には日本語が要る。引くのは2か所ある:
 *
 * - **かぶって隠れた行・表示に戻った行**（`SyncRecordFold`）— 隠れた側の表
 * - **親が削除されて表から外れた行・戻った行**（`SyncParentDeleted`）— 外れた子の表と、
 *   原因になった親の表
 *
 * **同じ文言を main（監査ログの summary）と renderer（トースト）の両方が組み立てる**ため、
 * 両側が値で引ける `src/lib/shared/` へ1つだけ置く（docs/coding-style.md「同じ結果を出す
 * 計算は `src/lib/shared/` へ」）。
 *
 * 載っているのは利用者が名前で分かる表だけで、**網羅は狙わない**（表は増え続けるので、
 * 載せ漏れを致命傷にしない）。載っていない表はテーブル名をそのまま出す。
 */
const SYNC_TABLE_LABELS: Record<string, string> = {
  // 人・学級
  User: "ユーザー",
  Classroom: "学級",
  Student: "生徒",
  StudentClassroomMembership: "生徒の学級所属",
  Tag: "タグ",

  // 試験
  Exam: "試験",
  ExamPage: "試験のページ",
  ExamStudent: "試験の受験生徒",
  ExamClassroom: "試験の学級",
  ExamSubtotalGroup: "試験の小計点グループ",
  ExamTag: "試験のタグ",
  UserExam: "試験の担当者",
  StudentAnswerImage: "答案画像",
  CropRegion: "採点領域",
  CropRegionAssignment: "採点領域の担当割り当て",
  ExamStudentAssignment: "受験生徒の担当割り当て",
  CropRegionOmrConfig: "採点領域のOMR設定",
  CropRegionOmrChoiceOption: "OMRの選択肢",
  CompoundAnswer: "複合解答",
  CompoundAnswerMember: "複合解答の構成要素",
  CompoundAnswerScore: "複合解答の点数",
  QuestionScore: "設問ごとの点数",
  ScoreDecision: "確定した点数",
  DrawingAnnotation: "答案への書き込み",
  ReturnSnapshot: "返却版",
  SubtotalGroup: "小計点グループ",
  Subtotal: "小計点",
  CropSubtotal: "小計点の対象領域",
  TagSubtotalGroup: "タグと小計点グループの紐付け",
  AiPrompt: "AI採点のプロンプト",
  AiGradingRun: "AI採点の実行",
  AiGradingAttempt: "AI採点の判定",

  // 成績算出
  Grade: "成績算出",
  GradeTag: "成績算出のタグ",
  GradeItem: "評価項目",
  GradeItemBoundary: "評価項目の成績境界",
  GradeClassroom: "成績の学級",
  GradeStudent: "成績の生徒",
  GradeDataSource: "成績のデータソース",
  GradeDataSourceEstimationSource: "成績データソースの推定元",
  GradeOverride: "成績の上書き",
  GradeFrozenScore: "確定した成績値",
  GradeItemExclusion: "評価項目の除外",
  GradeExportComparison: "出力に載せる比較",
  GradeConstraint: "観点間制約",
  GradeConstraintViewpoint: "観点間制約の観点",
  GradeConstraintLabelValue: "観点間制約の評語の値",
  GradeConstraintExclusionLabel: "観点間制約の除外評語",

  // 試験外成績資料
  Coursework: "試験外成績資料",
  CourseworkItem: "試験外成績資料の項目",
  CourseworkClassroom: "試験外成績資料の学級",
  CourseworkStudent: "試験外成績資料の生徒",
  CourseworkTag: "試験外成績資料のタグ",
  CourseworkScore: "試験外成績資料の点数",
  CourseworkLetterScale: "試験外成績資料の評語",

  // 解答用紙定義
  AsbDefinition: "解答用紙定義",
  AsbDefinitionTag: "解答用紙定義のタグ",
  AsbHeaderField: "解答用紙の記入欄",
  AsbMajorQuestion: "解答用紙の大問",
  AsbSubQuestion: "解答用紙の小問",
  AsbBranchQuestion: "解答用紙の枝問",

  // 設定（利用者ごと／全員で共通）。**テーブル名の直訳ではなく画面で見る言葉で呼ぶ。**
  // 設定を同期に載せると初回は数十行がまとまって届くので、ここが抜けていると
  // 「UserPreference 20件」のような英語のテーブル名がそのままトーストに出る
  UserPreference: "自分の設定",
  UserKeyboardShortcut: "ショートカットキー",
  UserScoringStatusColor: "採点状態の表示色",
  UserClickScoringAction: "クリック採点の設定",
  UserSidePanelSection: "パネルの開閉",
  AppPreference: "全員で共通の設定",
}

/** テーブル名を日本語の呼び名にする。知らない表はテーブル名をそのまま返す */
export const syncTableLabel = (tableName: string): string =>
  SYNC_TABLE_LABELS[tableName] ?? tableName
