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
  },
  exam: {
    detail: (examId: string) => ["exam", examId] as const,
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
  },
  grade: {
    list: () => ["grade", "list"] as const,
    detail: (gradeId: string) => ["grade", gradeId] as const,
    classrooms: (gradeId: string) => ["grade", gradeId, "classrooms"] as const,
    constraints: (gradeId: string) => ["grade", gradeId, "constraints"] as const,
    exclusions: (gradeId: string) => ["grade", gradeId, "exclusions"] as const,
    results: (gradeId: string) => ["grade", gradeId, "results"] as const,
    sourceFits: (gradeId: string) => ["grade", gradeId, "sourceFits"] as const,
  },
  coursework: {
    list: () => ["coursework", "list"] as const,
    detail: (courseworkId: string) => ["coursework", courseworkId] as const,
    classrooms: (courseworkId: string) =>
      ["coursework", courseworkId, "classrooms"] as const,
    scores: (courseworkItemId: string) =>
      ["courseworkScores", courseworkItemId] as const,
  },
} as const
