import type { AuditLogFilter } from "@/electron-src/lib/prisma/auditQuery"

/**
 * TanStack Query のキー。
 *
 * キーは配列の前方一致で無効化されるので、`["coursework", courseworkId]` を消すと
 * その資料に紐づくものが全部消える。粗く消したいときは上位を、一点だけ消したいときは
 * 末端を指定する。
 *
 * 文字列リテラルを画面側に散らかさないため、キーは必ずここを経由して作る。
 * 同定は必ず id で行い、順序や表示名をキーに混ぜない。
 *
 * **キーは「格納する形」ごとに分ける。** 同じキーに違う形を書くと、後からマウントした
 * 画面が `isPending: false` のまま相手のデータで描画される（キャッシュは同期的に返る）。
 * 型では止まらない。`detail` は「その実体そのもの」を取る用途にだけ使い、画面が
 * まとめて1回で取る複合ペイロードには `*Page` の名前を与える。
 *
 * **使う場所ができてから足す。** 使われないキーは「そのうち要る」の形をした
 * デッドコードで、消す判断が誰にもできなくなる。
 */
export const queryKeys = {
  userPreference: {
    detail: (userId: string | undefined, key: string) =>
      ["userPreference", userId, key] as const,
  },
  currentUser: {
    all: ["currentUser"] as const,
  },
  users: {
    all: ["users"] as const,
  },
  settings: {
    /** main が持つプロジェクターモードの現在状態 */
    projectorMode: ["settings", "projectorMode"] as const,
    /** 同期設定（設定＋保存先＋現在の状態） */
    sync: ["settings", "sync"] as const,
    /** 利用者ごとのキーバインディング */
    keyboardShortcuts: (userId: string | undefined) =>
      ["settings", "keyboardShortcuts", userId] as const,
  },
  tags: {
    all: ["tags"] as const,
  },
  students: {
    all: ["students"] as const,
  },
  auditLog: {
    /**
     * 監査ログの一覧（無限スクロール）。
     * 絞り込み条件は要求そのものなのでキーに入る（同定用の id ではない）。
     */
    list: (filter: AuditLogFilter) => ["auditLog", "list", filter] as const,
  },
  classrooms: {
    all: ["classrooms"] as const,
  },
  annotation: {
    /** 設問1つ分の手書き（グリッド表示が全受験者ぶん一括で取る） */
    byCropRegion: (
      cropRegionId: string | undefined,
      userId: string | undefined
    ) => ["annotation", "byCropRegion", cropRegionId, userId] as const,
    /** 受験者1人分の全設問の手書き（個別表示の透明度制御が読む） */
    byExamStudent: (
      examStudentId: string | undefined,
      userId: string | undefined
    ) => ["annotation", "byExamStudent", examStudentId, userId] as const,
  },
  studentAnswerImage: {
    /** 答案1枚に載っている採点結果の要約（削除確認で読む） */
    scoreSummary: (studentAnswerImageId: string) =>
      ["studentAnswerImage", studentAnswerImageId, "scoreSummary"] as const,
  },
  studentExamResults: {
    detail: (studentId: string) => ["studentExamResults", studentId] as const,
  },
  classroomExamResults: {
    detail: (classroomId: string) =>
      ["classroomExamResults", classroomId] as const,
  },
  returnDiff: {
    detail: (examId: string) => ["returnDiff", examId] as const,
  },
  subtotalGroup: {
    all: ["subtotalGroup"] as const,
  },
  subtotalGroupsForReport: {
    detail: (examId: string) => ["subtotalGroupsForReport", examId] as const,
  },
  answerSheetDefinition: {
    /**
     * 解答用紙1件に紐づくキーの前方一致。**格納しない**（無効化の範囲指定専用）。
     * 担当が変わると owner も detail も古くなるので、まとめて取り直す。
     */
    scope: (definitionId: string) =>
      ["answerSheetDefinition", definitionId] as const,
    /** 一覧（誰の解答用紙も出る。自分の分だけを見る絞り込みは表示側） */
    list: () => ["answerSheetDefinition", "list"] as const,
    /** 解答用紙定義そのもの（編集・書き出し・パンくずが共有する） */
    detail: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "detail"] as const,
    /** その解答用紙の担当者（編集できる唯一の利用者） */
    owner: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "owner"] as const,
    /** その解答用紙に紐づくタグ */
    tags: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "tags"] as const,
  },
  exam: {
    /**
     * 試験1件に紐づくキーの前方一致。**格納しない**（無効化の範囲指定専用）。
     * 試験の実体そのものが変わったときだけ使う。
     */
    scope: (examId: string) => ["exam", examId] as const,
    /** 試験1件そのもの（パンくず・答案アップロードなど、本体だけ要る画面） */
    detail: (examId: string) => ["exam", examId, "detail"] as const,
    /** 試験詳細ページが1回で取る形（試験本体＋進捗の分母になる件数） */
    detailPage: (examId: string) => ["exam", examId, "detailPage"] as const,
    /** 領域情報ページ(03)が1回で取る形（操作者＋ページ＋背景画像＋採点領域） */
    regionInfoPage: (examId: string) =>
      ["exam", examId, "regionInfoPage"] as const,
    /** 小計点設定ページ(04)が1回で取る形（小計点グループ＋設問領域＋小計欄領域） */
    questionGroupPage: (examId: string) =>
      ["exam", examId, "questionGroupPage"] as const,
    /** 結果出力ページ(08)が1回で取る形（試験＋受験者） */
    exportPage: (examId: string) => ["exam", examId, "exportPage"] as const,
    /** 出力設定（重ね描き＋個人成績表。小計グループ選択は関連フラグから解決済み） */
    exportSettings: (examId: string) =>
      ["exam", examId, "exportSettings"] as const,
    /** 模範解答1ページ目の縦横比から決まる用紙の向き */
    masterImageOrientation: (examId: string) =>
      ["exam", examId, "masterImageOrientation"] as const,
    classrooms: (examId: string) => ["exam", examId, "classrooms"] as const,
    /** この試験に紐づくタグ（タグ一覧そのものは queryKeys.tags.all） */
    tags: (examId: string) => ["exam", examId, "tags"] as const,
    masterAnswers: (examId: string) =>
      ["exam", examId, "masterAnswers"] as const,
    omrConfigs: (examId: string) => ["exam", examId, "omrConfigs"] as const,
    decisionSummary: (examId: string, userId: string | undefined) =>
      ["exam", examId, "decisionSummary", userId] as const,
    cropRegionAssignments: (examId: string, userId: string | undefined) =>
      ["exam", examId, "cropRegionAssignments", userId] as const,
    members: (examId: string) => ["exam", examId, "members"] as const,
    /** この試験にまだ追加していない小計点グループ */
    availableSubtotalGroups: (examId: string) =>
      ["exam", examId, "availableSubtotalGroups"] as const,
    /** 採点マーク・点数の重ね描き設定（07 の個別表示が読む） */
    answerOverlaySettings: (examId: string) =>
      ["exam", examId, "answerOverlaySettings"] as const,
    /** 模範解答のマスターマーカー検出結果（補正の可否判定） */
    masterMarkers: (examId: string) =>
      ["exam", examId, "masterMarkers"] as const,
    /** Excel出力のプレビュー（選択した受験者ぶん） */
    excelPreview: (examId: string, examStudentIds: readonly string[]) =>
      ["exam", examId, "excelPreview", [...examStudentIds]] as const,
    /** 個人成績表のプレビュー（受験者1人ぶん） */
    individualReportPreview: (examId: string, examStudentId: string) =>
      ["exam", examId, "individualReportPreview", examStudentId] as const,
    /** その利用者がこの試験のオーナーか */
    owner: (examId: string, userId: string | undefined) =>
      ["exam", examId, "owner", userId] as const,
    /** 招待先の利用者検索（検索語は要求の一部なのでキーに入る） */
    userSearch: (examId: string, query: string) =>
      ["exam", examId, "userSearch", query] as const,
    /** 採点済み答案のプレビュー（受験者1人ぶん） */
    scoredAnswerPreview: (examId: string, examStudentId: string) =>
      ["exam", examId, "scoredAnswerPreview", examStudentId] as const,
    /** 採点画面(07)が1回で取る形（試験＋ページ＋答案） */
    scoringPage: (examId: string) => ["exam", examId, "scoringPage"] as const,
  },
  /**
   * 汎用の名簿UI（RosterTable / StudentAddPanel / ClassroomRosterManager）。
   *
   * 中身は差し込まれた adapter が決めるので、何の名簿かはキーからは分からない。
   * 取り違えを避けるため、コンポーネントの実体（`useId`）で必ず区切る。
   */
  roster: {
    table: (instanceId: string) => ["roster", instanceId, "table"] as const,
    availableClassrooms: (instanceId: string) =>
      ["roster", instanceId, "availableClassrooms"] as const,
    addPanelClassrooms: (instanceId: string, activeOnly: boolean) =>
      ["roster", instanceId, "addPanelClassrooms", activeOnly] as const,
    addPanelStudents: (instanceId: string, activeOnly: boolean) =>
      ["roster", instanceId, "addPanelStudents", activeOnly] as const,
  },
  grade: {
    list: () => ["grade", "list"] as const,
    /** データソースに指定できる試験の候補 */
    examCandidates: () => ["grade", "examCandidates"] as const,
    /** ある試験の中で指定できる小計点・設問領域の候補 */
    examOptions: (examId: string) => ["grade", "examOptions", examId] as const,
    /**
     * 成績本体（評価項目・データソース・境界を子として同梱）。
     * 3画面が同一の queryFn（`grade.getById`）で共有する。
     */
    detail: (gradeId: string) => ["grade", gradeId, "detail"] as const,
    classrooms: (gradeId: string) => ["grade", gradeId, "classrooms"] as const,
    constraints: (gradeId: string) =>
      ["grade", gradeId, "constraints"] as const,
    exclusions: (gradeId: string) => ["grade", gradeId, "exclusions"] as const,
    results: (gradeId: string) => ["grade", gradeId, "results"] as const,
    sourceFits: (gradeId: string) => ["grade", gradeId, "sourceFits"] as const,
    /** 外部成績ページ(04)が1回で取る形（資料ソース＋対象者数＋入力済み数） */
    manualScoresPage: (gradeId: string) =>
      ["grade", gradeId, "manualScoresPage"] as const,
    /** 出力設定（個人成績通知書のオプション） */
    exportSettings: (gradeId: string) =>
      ["grade", gradeId, "exportSettings"] as const,
  },
  coursework: {
    list: () => ["coursework", "list"] as const,
    /** データソースに指定できる資料の候補 */
    candidates: () => ["coursework", "candidates"] as const,
    /**
     * 資料本体（評価項目・学級・タグを子として同梱）。
     * 概要(01)と評価項目(03)が同一の queryFn（`coursework.getById`）で共有する。
     */
    detail: (courseworkId: string) =>
      ["coursework", courseworkId, "detail"] as const,
    classrooms: (courseworkId: string) =>
      ["coursework", courseworkId, "classrooms"] as const,
    scores: (courseworkItemId: string) =>
      ["courseworkScores", courseworkItemId] as const,
  },
} as const
