/**
 * 統合アーカイブ（.sao）の範囲を決める、テーブルごとの役割の登録表
 *
 * 設計は docs/unified-archive-design.md §5。外部キーのつながりは DB の
 * `PRAGMA foreign_key_list` ではなく、この表から取る。DB の制約は migration の書き方次第で
 * schema.prisma とずれうる（GradeDataSource の courseworkId / courseworkItemId は制約なしで
 * 足され、20261004130000 で直すまで本番だけ欠けていた）。書き出しは古い版の DB からも行うので、
 * DB から読むと参照を取りこぼす。
 *
 * 表と schema.prisma の一致は `__tests__/import-export/unit/unifiedArchiveRegistry.test.ts` が
 * 検査する。モデルや `@relation` を足したら、ここにも足すこと。
 */

import type { ArchiveOptionalItem } from "../../../../src/types/unifiedArchive.types"

/**
 * 表の役割。
 *
 * - root: 利用者が選ぶ4種（試験・資料・成績算出・解答用紙定義）。選ぶと配下が丸ごと入る
 * - shared: 共通の実体。入った行が参照すると引き上げる。利用者が直接選ぶこともできる
 * - owned: 親（owner の列が指す行）に従う。親が入れば入り、親が外れれば外れる
 * - link: 両側が入ったときだけ入る中間テーブル
 * - optional: 関連データではないが、書き出し画面で選べば入る（既定は含めない）
 */
export type ArchiveTableRole = "root" | "shared" | "owned" | "link" | "optional"

/** 外部キーの列1本 */
export interface ArchiveReference {
  readonly column: string
  readonly table: string
  /** NOT NULL か。外れた行を指すとき、必須なら参照する行ごと外れ、任意なら NULL にする */
  readonly required: boolean
  /**
   * 利用者が参照先を外せない（成績算出が使う試験・資料・小計など。docs §5.2）。
   * 外そうとすると範囲の解決が失敗する
   */
  readonly forced?: boolean
}

export interface ArchiveTableSpec {
  readonly role: ArchiveTableRole
  /**
   * owned / optional の行を所有する親を指す列。複数あるときは、値の入っている最初の列が
   * 親になる（解答用紙の要素は小問か枝問のどちらかに属する）
   */
  readonly owner?: readonly string[]
  readonly option?: ArchiveOptionalItem
  readonly references: readonly ArchiveReference[]
}

const required = (column: string, table: string): ArchiveReference => ({
  column,
  table,
  required: true,
})
const nullable = (column: string, table: string): ArchiveReference => ({
  column,
  table,
  required: false,
})
const forcedNullable = (column: string, table: string): ArchiveReference => ({
  column,
  table,
  required: false,
  forced: true,
})

/** 試験の下の、試験だけを親に持つ設定の表 */
const examSetting: ArchiveTableSpec = {
  role: "owned",
  owner: ["examId"],
  references: [required("examId", "Exam")],
}

/** 利用者個人の設定の表 */
const userSetting: ArchiveTableSpec = {
  role: "optional",
  option: "userSettings",
  owner: ["userId"],
  references: [required("userId", "User")],
}

/** 小問か枝問のどちらかに属する解答用紙の要素 */
const asbQuestionElement: ArchiveTableSpec = {
  role: "owned",
  owner: ["subQuestionId", "branchQuestionId"],
  references: [
    nullable("subQuestionId", "AsbSubQuestion"),
    nullable("branchQuestionId", "AsbBranchQuestion"),
  ],
}

export const ARCHIVE_TABLES: Readonly<Record<string, ArchiveTableSpec>> = {
  // ── 共通の実体 ──────────────────────────────────────────────
  User: { role: "shared", references: [] },
  Student: { role: "shared", references: [] },
  Classroom: { role: "shared", references: [] },
  // 在籍は生徒に従う（入った生徒の全期間。docs §5.3）。学級は参照で引き上げる
  StudentClassroomMembership: {
    role: "owned",
    owner: ["studentId"],
    references: [
      required("studentId", "Student"),
      required("classroomId", "Classroom"),
    ],
  },
  SubtotalGroup: { role: "shared", references: [] },
  Subtotal: {
    role: "owned",
    owner: ["subtotalGroupId"],
    references: [required("subtotalGroupId", "SubtotalGroup")],
  },
  Tag: { role: "shared", references: [] },
  TagSubtotalGroup: {
    role: "link",
    references: [
      required("tagId", "Tag"),
      required("subtotalGroupId", "SubtotalGroup"),
    ],
  },

  // ── 試験 ────────────────────────────────────────────────────
  Exam: { role: "root", references: [] },
  ExamPage: examSetting,
  ExamAnswerOverlayStyle: examSetting,
  ExamAnswerOverlayVisibility: examSetting,
  ExamIndividualReportSettings: examSetting,
  ExamIndividualReportGraphSettings: examSetting,
  ExamIndividualReportStatisticVisibility: examSetting,
  ExamIndividualReportTableSection: examSetting,
  ExamStudent: {
    role: "owned",
    owner: ["examId"],
    references: [required("examId", "Exam"), required("studentId", "Student")],
  },
  ExamClassroom: {
    role: "owned",
    owner: ["examId"],
    references: [
      required("examId", "Exam"),
      required("classroomId", "Classroom"),
    ],
  },
  ExamSubtotalGroup: {
    role: "owned",
    owner: ["examId"],
    references: [
      required("examId", "Exam"),
      required("subtotalGroupId", "SubtotalGroup"),
    ],
  },
  ExamTag: {
    role: "owned",
    owner: ["examId"],
    references: [required("examId", "Exam"), required("tagId", "Tag")],
  },
  UserExam: {
    role: "owned",
    owner: ["examId"],
    references: [
      required("examId", "Exam"),
      required("userId", "User"),
      nullable("invitedBy", "User"),
    ],
  },
  CropRegion: {
    role: "owned",
    owner: ["examPageId"],
    references: [required("examPageId", "ExamPage")],
  },
  CropRegionOmrConfig: {
    role: "owned",
    owner: ["cropRegionId"],
    references: [required("cropRegionId", "CropRegion")],
  },
  CropRegionOmrChoiceOption: {
    role: "owned",
    owner: ["omrConfigId"],
    references: [required("omrConfigId", "CropRegionOmrConfig")],
  },
  CropRegionAssignment: {
    role: "owned",
    owner: ["cropRegionId"],
    references: [
      required("cropRegionId", "CropRegion"),
      required("userId", "User"),
      nullable("assignedBy", "User"),
    ],
  },
  ExamStudentAssignment: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      required("userId", "User"),
      nullable("assignedBy", "User"),
    ],
  },
  CropSubtotal: {
    role: "owned",
    owner: ["cropRegionId"],
    references: [
      required("cropRegionId", "CropRegion"),
      required("subtotalId", "Subtotal"),
    ],
  },
  CompoundAnswer: {
    role: "owned",
    owner: ["examPageId"],
    references: [required("examPageId", "ExamPage")],
  },
  CompoundAnswerMember: {
    role: "owned",
    owner: ["compoundAnswerId"],
    references: [
      required("compoundAnswerId", "CompoundAnswer"),
      required("cropRegionId", "CropRegion"),
    ],
  },
  StudentAnswerImage: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      required("examPageId", "ExamPage"),
    ],
  },
  QuestionScore: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      required("cropRegionId", "CropRegion"),
      required("userId", "User"),
    ],
  },
  DrawingAnnotation: {
    role: "owned",
    owner: ["questionScoreId"],
    references: [required("questionScoreId", "QuestionScore")],
  },
  // ルーブリック採点（教員の層。docs/vlm-grading-design.md §5-2）。項目と重なった助言の決まりは
  // 設問に従い（採点者の間で共有）、適用は採点行に従う（本人分だけにすると他の教員の適用も外れる）
  RubricItem: {
    role: "owned",
    owner: ["cropRegionId"],
    references: [
      required("cropRegionId", "CropRegion"),
      nullable("createdByUserId", "User"),
    ],
  },
  RubricApplication: {
    role: "owned",
    owner: ["questionScoreId"],
    references: [
      required("questionScoreId", "QuestionScore"),
      required("rubricItemId", "RubricItem"),
    ],
  },
  RubricAdviceCombination: {
    role: "owned",
    owner: ["cropRegionId"],
    references: [
      required("cropRegionId", "CropRegion"),
      nullable("primaryRubricItemId", "RubricItem"),
    ],
  },
  RubricAdviceCombinationItem: {
    role: "owned",
    owner: ["combinationId"],
    references: [
      required("combinationId", "RubricAdviceCombination"),
      required("rubricItemId", "RubricItem"),
    ],
  },
  CompoundAnswerScore: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      required("compoundAnswerId", "CompoundAnswer"),
      required("userId", "User"),
    ],
  },
  ScoreDecision: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      required("cropRegionId", "CropRegion"),
      required("decidedByUserId", "User"),
    ],
  },
  ReturnSnapshot: {
    role: "owned",
    owner: ["examStudentId"],
    references: [
      required("examStudentId", "ExamStudent"),
      nullable("capturedByUserId", "User"),
    ],
  },

  // ── 試験外成績資料 ──────────────────────────────────────────
  Coursework: { role: "root", references: [] },
  CourseworkClassroom: {
    role: "owned",
    owner: ["courseworkId"],
    references: [
      required("courseworkId", "Coursework"),
      required("classroomId", "Classroom"),
    ],
  },
  CourseworkStudent: {
    role: "owned",
    owner: ["courseworkId"],
    references: [
      required("courseworkId", "Coursework"),
      required("studentId", "Student"),
    ],
  },
  CourseworkTag: {
    role: "owned",
    owner: ["courseworkId"],
    references: [
      required("courseworkId", "Coursework"),
      required("tagId", "Tag"),
    ],
  },
  CourseworkItem: {
    role: "owned",
    owner: ["courseworkId"],
    references: [required("courseworkId", "Coursework")],
  },
  CourseworkLetterScale: {
    role: "owned",
    owner: ["courseworkItemId"],
    references: [required("courseworkItemId", "CourseworkItem")],
  },
  CourseworkScore: {
    role: "owned",
    owner: ["courseworkStudentId"],
    references: [
      required("courseworkStudentId", "CourseworkStudent"),
      required("courseworkItemId", "CourseworkItem"),
    ],
  },

  // ── 成績算出 ────────────────────────────────────────────────
  Grade: { role: "root", references: [] },
  GradeTag: {
    role: "owned",
    owner: ["gradeId"],
    references: [required("gradeId", "Grade"), required("tagId", "Tag")],
  },
  GradeClassroom: {
    role: "owned",
    owner: ["gradeId"],
    references: [
      required("gradeId", "Grade"),
      required("classroomId", "Classroom"),
    ],
  },
  GradeStudent: {
    role: "owned",
    owner: ["gradeId"],
    references: [
      required("gradeId", "Grade"),
      required("studentId", "Student"),
    ],
  },
  GradeIndividualReportSettings: {
    role: "owned",
    owner: ["gradeId"],
    references: [required("gradeId", "Grade")],
  },
  GradeItem: {
    role: "owned",
    owner: ["gradeId"],
    references: [required("gradeId", "Grade")],
  },
  GradeItemBoundary: {
    role: "owned",
    owner: ["gradeItemId"],
    references: [required("gradeItemId", "GradeItem")],
  },
  // 比較先は任意の成績算出の評価項目。既定で比較先の成績算出も含め、外せば比較が外れる
  GradeComparison: {
    role: "owned",
    owner: ["gradeItemId"],
    references: [
      required("gradeItemId", "GradeItem"),
      required("comparedGradeItemId", "GradeItem"),
    ],
  },
  // 出力で使う比較の選択。比較に従う（比較が外れれば一緒に外れる）
  GradeExportComparison: {
    role: "owned",
    owner: ["gradeComparisonId"],
    references: [
      required("gradeId", "Grade"),
      required("gradeComparisonId", "GradeComparison"),
    ],
  },
  // 成績算出が使う試験・資料・小計・採点枠は外せない（docs §5.2）
  GradeDataSource: {
    role: "owned",
    owner: ["gradeItemId"],
    references: [
      required("gradeItemId", "GradeItem"),
      forcedNullable("examId", "Exam"),
      forcedNullable("subtotalId", "Subtotal"),
      forcedNullable("cropRegionId", "CropRegion"),
      forcedNullable("courseworkItemId", "CourseworkItem"),
      forcedNullable("courseworkId", "Coursework"),
    ],
  },
  GradeDataSourceEstimationSource: {
    role: "owned",
    owner: ["dataSourceId"],
    references: [
      required("dataSourceId", "GradeDataSource"),
      required("sourceDataSourceId", "GradeDataSource"),
    ],
  },
  GradeConstraint: {
    role: "owned",
    owner: ["gradeId"],
    references: [
      required("gradeId", "Grade"),
      nullable("targetGradeItemId", "GradeItem"),
    ],
  },
  GradeConstraintViewpoint: {
    role: "owned",
    owner: ["constraintId"],
    references: [
      required("constraintId", "GradeConstraint"),
      required("gradeItemId", "GradeItem"),
    ],
  },
  GradeConstraintLabelValue: {
    role: "owned",
    owner: ["constraintId"],
    references: [required("constraintId", "GradeConstraint")],
  },
  GradeConstraintExclusionLabel: {
    role: "owned",
    owner: ["constraintId"],
    references: [required("constraintId", "GradeConstraint")],
  },
  GradeItemExclusion: {
    role: "owned",
    owner: ["gradeStudentId"],
    references: [
      required("gradeStudentId", "GradeStudent"),
      required("gradeItemId", "GradeItem"),
    ],
  },
  GradeOverride: {
    role: "owned",
    owner: ["gradeStudentId"],
    references: [
      required("gradeStudentId", "GradeStudent"),
      required("gradeItemId", "GradeItem"),
    ],
  },
  GradeFrozenScore: {
    role: "owned",
    owner: ["gradeStudentId"],
    references: [
      required("gradeStudentId", "GradeStudent"),
      required("gradeItemId", "GradeItem"),
      nullable("frozenByUserId", "User"),
    ],
  },

  // ── 解答用紙定義 ────────────────────────────────────────────
  AsbDefinition: { role: "root", references: [required("userId", "User")] },
  AsbDefinitionTag: {
    role: "owned",
    owner: ["asbDefinitionId"],
    references: [
      required("asbDefinitionId", "AsbDefinition"),
      required("tagId", "Tag"),
    ],
  },
  AsbHeaderField: {
    role: "owned",
    owner: ["definitionId"],
    references: [required("definitionId", "AsbDefinition")],
  },
  AsbMajorQuestion: {
    role: "owned",
    owner: ["definitionId"],
    references: [required("definitionId", "AsbDefinition")],
  },
  AsbSubQuestion: {
    role: "owned",
    owner: ["majorQuestionId"],
    references: [required("majorQuestionId", "AsbMajorQuestion")],
  },
  AsbBranchQuestion: {
    role: "owned",
    owner: ["subQuestionId"],
    references: [required("subQuestionId", "AsbSubQuestion")],
  },
  AsbTextElement: asbQuestionElement,
  AsbImageElement: asbQuestionElement,
  AsbOmrConfig: asbQuestionElement,
  AsbManuscriptPaper: asbQuestionElement,
  AsbOmrChoiceOption: {
    role: "owned",
    owner: ["omrConfigId"],
    references: [required("omrConfigId", "AsbOmrConfig")],
  },
  AsbCharGuide: {
    role: "owned",
    owner: ["manuscriptPaperId"],
    references: [required("manuscriptPaperId", "AsbManuscriptPaper")],
  },

  // ── 選べる項目（既定は含めない。docs §5.5） ──────────────────
  UserKeyboardShortcut: userSetting,
  UserPreference: userSetting,
  UserScoringStatusColor: userSetting,
  UserClickScoringAction: userSetting,
  UserSidePanelSection: userSetting,
  AppPreference: { role: "optional", option: "appPreference", references: [] },
  // 範囲（scopeId）が書き出した根を指す行だけ。外部キーは無い（多態参照）
  AuditLog: { role: "optional", option: "auditLog", references: [] },
  // AI 採点の記録（docs/vlm-grading-design.md §4-2）。試験の配下だが、関連データではなく
  // 実験の記録なので選んだときだけ入れる。プロンプトは設問に、実行はプロンプトに、判定は
  // 実行に従う。判定は受験生を必須で参照するので、採点と答案を外せば判定も外れる。
  // 本人分だけにしたときは、他の教員の実行（とその判定）を外す（archiveScopeResolver.ts）
  AiPrompt: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["cropRegionId"],
    references: [
      required("cropRegionId", "CropRegion"),
      nullable("parentPromptId", "AiPrompt"),
      nullable("createdByUserId", "User"),
    ],
  },
  AiPromptQuestionImage: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["promptId"],
    references: [required("promptId", "AiPrompt")],
  },
  AiGradingRun: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["promptId"],
    references: [
      required("userId", "User"),
      required("promptId", "AiPrompt"),
      nullable("resultPromptId", "AiPrompt"),
    ],
  },
  AiGradingAttempt: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["runId"],
    references: [
      required("runId", "AiGradingRun"),
      required("examStudentId", "ExamStudent"),
      nullable("adoptedQuestionScoreId", "QuestionScore"),
      nullable("adoptedDrawingAnnotationId", "DrawingAnnotation"),
    ],
  },
  // 1段目の当てはまりと2段目の項目の案（§5-3）。試行・実行・案に従う。項目（教員の層）は
  // 試験の設問の配下なので入っている。選択肢・答案（試行）が外れれば、それを指す行も外れる
  AiAttemptRubricMatch: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["attemptId"],
    references: [
      required("attemptId", "AiGradingAttempt"),
      required("rubricItemId", "RubricItem"),
    ],
  },
  AiRubricProposal: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["runId"],
    references: [
      required("runId", "AiGradingRun"),
      nullable("matchedRubricItemId", "RubricItem"),
    ],
  },
  AiRubricProposalOption: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["proposalId"],
    references: [required("proposalId", "AiRubricProposal")],
  },
  AiRubricProposalMember: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["proposalId"],
    references: [
      required("proposalId", "AiRubricProposal"),
      required("attemptId", "AiGradingAttempt"),
    ],
  },
  AiRubricProposalResponse: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["proposalId"],
    references: [
      required("proposalId", "AiRubricProposal"),
      nullable("optionId", "AiRubricProposalOption"),
      nullable("resultRubricItemId", "RubricItem"),
    ],
  },
  // 問いかけの答えの下書きと確定（§3-5）。答え・試行に従う
  AiRubricProposalResponseScore: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["responseId"],
    references: [
      required("responseId", "AiRubricProposalResponse"),
      required("attemptId", "AiGradingAttempt"),
    ],
  },
  AiAttemptResponse: {
    role: "optional",
    option: "aiGradingRecords",
    owner: ["attemptId"],
    references: [required("attemptId", "AiGradingAttempt")],
  },
  // 監査ログの対象。ログに従う（対象側の targetId は外部キーではない多態参照）
  AuditLogTarget: {
    role: "owned",
    owner: ["auditLogId"],
    references: [required("auditLogId", "AuditLog")],
  },
}

/** 利用者が選ぶ4種の根 */
export const ARCHIVE_ROOT_TABLES = [
  "Exam",
  "Coursework",
  "Grade",
  "AsbDefinition",
] as const
export type ArchiveRootTable = (typeof ARCHIVE_ROOT_TABLES)[number]
