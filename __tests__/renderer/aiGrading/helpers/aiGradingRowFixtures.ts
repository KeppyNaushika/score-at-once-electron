/**
 * 07 の AI採点モードの純粋関数・画面のテスト用の、合成した行。
 *
 * 実データは使わない。id は読みやすさのために固定の文字列にする。
 */

import type {
  AiGradingAnswer,
  AiGradingAttemptRow,
  AiGradingRunRow,
  AiPromptRow,
  AttemptWithRun,
  RegionInkMeasurementRow,
} from "@/components/exams/07-score-at-once/AiGrading/types"
import type { QuestionScoreRow } from "@/queries/scoring"
import type { StudentAnswerImageWithExamPageAndStudent } from "@/types/prismaExtensions"

export const CROP_REGION_ID = "crop-region-1"
export const EXAM_PAGE_ID = "exam-page-1"
export const CURRENT_USER_ID = "user-1"
const FIXED_DATE = new Date("2026-10-01T00:00:00.000Z")

export function makeQuestionScore(
  overrides: Partial<QuestionScoreRow> & { examStudentId: string }
): QuestionScoreRow {
  return {
    id: `score-${overrides.examStudentId}`,
    cropRegionId: CROP_REGION_ID,
    partialScore: null,
    status: "correct",
    comment: "",
    userId: CURRENT_USER_ID,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function makePrompt(overrides: Partial<AiPromptRow> = {}): AiPromptRow {
  return {
    id: "prompt-1",
    cropRegionId: CROP_REGION_ID,
    parentPromptId: null,
    createdByUserId: CURRENT_USER_ID,
    questionText: "",
    questionImagePath: null,
    modelAnswerText: "x = 2",
    sendModelAnswerImage: false,
    rubricText: "",
    annotationInstruction: "",
    revisionInstruction: "",
    revisionMessage: "",
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    createdBy: null,
    ...overrides,
  }
}

export function makeAttempt(
  overrides: Partial<AiGradingAttemptRow> & { examStudentId: string }
): AiGradingAttemptRow {
  return {
    id: `attempt-${overrides.examStudentId}`,
    runId: "run-1",
    state: "succeeded",
    status: "correct",
    partialScore: null,
    comment: "",
    annotationText: "",
    transcription: "",
    confidence: "high",
    errorMessage: "",
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    adoptedQuestionScoreId: null,
    adoptedDrawingAnnotationId: null,
    adoptedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  }
}

export function makeRun(
  overrides: Partial<AiGradingRunRow> = {}
): AiGradingRunRow {
  const prompt = makePrompt({ id: overrides.promptId ?? "prompt-1" })
  return {
    id: "run-1",
    userId: CURRENT_USER_ID,
    promptId: prompt.id,
    purpose: "grade",
    templateVersion: "1",
    provider: "anthropic",
    model: "claude-opus-5-5",
    effort: "medium",
    mode: "realtime",
    status: "ended",
    externalBatchId: null,
    submittedClientId: "client-1",
    imageScale: 1,
    points: 4,
    resultPromptId: null,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    endedAt: null,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    attempts: [],
    prompt,
    resultPrompt: null,
    user: {
      id: CURRENT_USER_ID,
      username: "teacher",
      name: "テスト先生",
      role: "teacher",
      passcodeType: null,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    ...overrides,
  }
}

/** 試行1件と、それだけを持つ実行 */
export function makeAttemptWithRun(
  attemptOverrides: Partial<AiGradingAttemptRow> & { examStudentId: string },
  runOverrides: Partial<AiGradingRunRow> = {}
): AttemptWithRun {
  const attempt = makeAttempt(attemptOverrides)
  return { attempt, run: makeRun({ ...runOverrides, attempts: [attempt] }) }
}

export function makeInk(
  overrides: Partial<RegionInkMeasurementRow> = {}
): RegionInkMeasurementRow {
  return {
    cropRegionId: CROP_REGION_ID,
    inkRatio: 0.05,
    blankness: "written",
    edgeInkDensities: { top: 0, right: 0, bottom: 0, left: 0 },
    edgeTouches: { top: false, right: false, bottom: false, left: false },
    overflowsFrame: false,
    inkGrid: {
      originX: 0.1,
      originY: 0.1,
      cellWidth: 1 / 210,
      cellHeight: 1 / 297,
      columnCount: 42,
      rowCount: 30,
      occupiedCells: new Array<boolean>(42 * 30).fill(false),
    },
    ...overrides,
  }
}

export function makeStudentAnswerImage(
  examStudentId: string,
  lastName = "生徒",
  firstName = examStudentId
): StudentAnswerImageWithExamPageAndStudent {
  return {
    id: `answer-image-${examStudentId}`,
    examPageId: EXAM_PAGE_ID,
    examStudentId,
    imagePath: `answers/${examStudentId}.png`,
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    examPage: {
      id: EXAM_PAGE_ID,
      examId: "exam-1",
      pageNumber: 1,
      imagePath: "master/page1.png",
      pageSize: "A4",
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
    },
    examStudent: {
      id: examStudentId,
      examId: "exam-1",
      studentId: `student-${examStudentId}`,
      status: "present",
      customOrder: null,
      createdAt: FIXED_DATE,
      updatedAt: FIXED_DATE,
      student: {
        id: `student-${examStudentId}`,
        studentNumber: examStudentId,
        lastName,
        firstName,
        lastNameKana: "セイト",
        firstNameKana: "テスト",
        enrollmentYear: null,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      },
    },
  }
}

export function makeAnswer(
  examStudentId: string,
  overrides: Partial<AiGradingAnswer> = {}
): AiGradingAnswer {
  return {
    studentAnswerImage: makeStudentAnswerImage(examStudentId),
    questionScore: undefined,
    attempts: [],
    inkMeasurement: makeInk(),
    ...overrides,
  }
}
