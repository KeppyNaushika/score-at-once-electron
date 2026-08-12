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
  tags: {
    all: ["tags"] as const,
  },
  students: {
    all: ["students"] as const,
  },
  classrooms: {
    all: ["classrooms"] as const,
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
    list: (userId: string | undefined) =>
      ["answerSheetDefinition", userId] as const,
    /** 解答用紙定義そのもの（編集・書き出し・パンくずが共有する） */
    detail: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "detail"] as const,
    /** その定義に紐づくタグ */
    tags: (definitionId: string) =>
      ["answerSheetDefinition", definitionId, "tags"] as const,
  },
  exam: {
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
  },
  grade: {
    list: () => ["grade", "list"] as const,
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
  },
  coursework: {
    list: () => ["coursework", "list"] as const,
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
