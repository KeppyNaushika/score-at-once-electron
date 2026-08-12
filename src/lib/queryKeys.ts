/**
 * TanStack Query のキー。
 *
 * キーは配列の前方一致で無効化されるので、`["userPreference", userId]` を消すと
 * その利用者の設定が全部消える。粗く消したいときは上位を、一点だけ消したいときは
 * 末端を指定する。
 *
 * 文字列リテラルを画面側に散らかさないため、キーは必ずここを経由して作る。
 * 同定は必ず id で行い、順序や表示名をキーに混ぜない。
 */
export const queryKeys = {
  userPreference: {
    all: ["userPreference"] as const,
    detail: (userId: string | undefined, key: string) =>
      ["userPreference", userId, key] as const,
  },
  keyboardShortcut: {
    detail: (userId: string | undefined) =>
      ["keyboardShortcut", userId] as const,
  },
  examExportSettings: {
    detail: (examId: string) => ["examExportSettings", examId] as const,
  },
  projectorMode: {
    all: ["projectorMode"] as const,
  },
  fullScreen: {
    all: ["fullScreen"] as const,
  },
  returnDiff: {
    detail: (examId: string) => ["returnDiff", examId] as const,
  },
  subtotalGroupsForReport: {
    detail: (examId: string) => ["subtotalGroupsForReport", examId] as const,
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
  auditLogs: {
    /** 絞り込み条件はキーの一部。条件が変われば別のクエリになる */
    list: (query: string, scopeId: string | null, page: number) =>
      ["auditLogs", query, scopeId, page] as const,
    scopeFacets: () => ["auditLogs", "scopeFacets"] as const,
  },
  classrooms: {
    all: ["classrooms"] as const,
    /** 対象（試験・成績・資料）に未登録の学級 */
    availableFor: (targetKind: string, targetId: string, activeOnly: boolean) =>
      ["classrooms", "availableFor", targetKind, targetId, activeOnly] as const,
  },
  students: {
    /** 対象に未登録の生徒 */
    availableFor: (targetKind: string, targetId: string, activeOnly: boolean) =>
      ["students", "availableFor", targetKind, targetId, activeOnly] as const,
  },
  subtotalGroup: {
    all: ["subtotalGroup"] as const,
    forExam: (examId: string) => ["subtotalGroup", "forExam", examId] as const,
  },
  answerSheetDefinition: {
    list: (userId: string | undefined) =>
      ["answerSheetDefinition", userId] as const,
  },
  exam: {
    all: ["exam"] as const,
    detail: (examId: string) => ["exam", examId] as const,
    withPages: (examId: string) => ["exam", examId, "withPages"] as const,
    students: (examId: string) => ["exam", examId, "students"] as const,
    classrooms: (examId: string) => ["exam", examId, "classrooms"] as const,
    cropRegions: (examId: string) => ["exam", examId, "cropRegions"] as const,
    masterAnswers: (examId: string) =>
      ["exam", examId, "masterAnswers"] as const,
    omrConfigs: (examId: string) => ["exam", examId, "omrConfigs"] as const,
    decisionSummary: (examId: string, userId: string | undefined) =>
      ["exam", examId, "decisionSummary", userId] as const,
    cropRegionAssignments: (examId: string, userId: string | undefined) =>
      ["exam", examId, "cropRegionAssignments", userId] as const,
    members: (examId: string) => ["exam", examId, "members"] as const,
    annotations: (examId: string) => ["exam", examId, "annotations"] as const,
  },
  grade: {
    all: ["grade"] as const,
    list: () => ["grade", "list"] as const,
    detail: (gradeId: string) => ["grade", gradeId] as const,
    classrooms: (gradeId: string) => ["grade", gradeId, "classrooms"] as const,
    constraints: (gradeId: string) =>
      ["grade", gradeId, "constraints"] as const,
    exclusions: (gradeId: string) => ["grade", gradeId, "exclusions"] as const,
    results: (gradeId: string) => ["grade", gradeId, "results"] as const,
    sourceFits: (gradeId: string) => ["grade", gradeId, "sourceFits"] as const,
  },
  coursework: {
    all: ["coursework"] as const,
    list: () => ["coursework", "list"] as const,
    detail: (courseworkId: string) => ["coursework", courseworkId] as const,
    students: (courseworkId: string) =>
      ["coursework", courseworkId, "students"] as const,
    classrooms: (courseworkId: string) =>
      ["coursework", courseworkId, "classrooms"] as const,
    scores: (courseworkItemId: string) =>
      ["courseworkScores", courseworkItemId] as const,
  },
} as const
