/**
 * テストデータファクトリ
 *
 * テスト用のアーカイブデータ、Prismaレコード、ID統合設定を生成するヘルパー
 */

import * as crypto from "crypto"

import type { ExtractedArchiveData } from "../../electron-src/lib/import/exam-archive/archiveExtractor"
import type {
  IdMappings,
  ImportCounts,
} from "../../electron-src/lib/import/merge/types"
import { createEmptyCounts } from "../../electron-src/lib/import/merge/types"
import type {
  ArchiveClassesData,
  ArchiveExamData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveTagsData,
  ArchiveUsersData,
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  MatchedItem,
  PreMatchingResult,
  ScoringConflict,
} from "../../src/types/examArchive.types"

// =============================================================================
// 基本ID生成
// =============================================================================

export function generateId(): string {
  return crypto.randomUUID()
}

// =============================================================================
// アーカイブデータ生成
// =============================================================================

export function createArchiveStudentsData(
  students: Array<{
    id?: string
    studentNumber?: string
    lastName?: string
    firstName?: string
    lastNameKana?: string
    firstNameKana?: string
    enrollmentYear?: number | null
  }> = []
): ArchiveStudentsData {
  return {
    students: students.map((student, i) => ({
      id: student.id ?? generateId(),
      studentNumber:
        student.studentNumber ?? `S${String(i + 1).padStart(3, "0")}`,
      lastName: student.lastName ?? `姓${i + 1}`,
      firstName: student.firstName ?? `名${i + 1}`,
      lastNameKana: student.lastNameKana ?? `セイ${i + 1}`,
      firstNameKana: student.firstNameKana ?? `メイ${i + 1}`,
      enrollmentYear: student.enrollmentYear ?? 2024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

export function createArchiveClassesData(
  classrooms: Array<{
    id?: string
    name?: string
    classroomCode?: string | null
    grade?: number | null
  }> = [],
  memberships: Array<{
    id?: string
    studentId: string
    classroomId: string
    attendanceNumber?: number | null
  }> = []
): ArchiveClassesData {
  return {
    classrooms: classrooms.map((classroom, i) => ({
      id: classroom.id ?? generateId(),
      name: classroom.name ?? `クラス${i + 1}`,
      classroomCode: classroom.classroomCode ?? null,
      grade: classroom.grade ?? null,
      description: null,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    memberships: memberships.map((membership) => ({
      id: membership.id ?? generateId(),
      studentId: membership.studentId,
      classroomId: membership.classroomId,
      startDate: new Date().toISOString(),
      endDate: null,
      attendanceNumber: membership.attendanceNumber ?? null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

export function createArchiveUsersData(
  users: Array<{
    id?: string
    username?: string
    name?: string
    role?: string
  }> = []
): ArchiveUsersData {
  return {
    users: users.map((user, i) => ({
      id: user.id ?? generateId(),
      username: user.username ?? `user${i + 1}`,
      name: user.name ?? `ユーザー${i + 1}`,
      role: user.role ?? "teacher",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

export function createArchiveExamData(
  overrides: {
    examId?: string
    examName?: string
    pageCount?: number
    cropRegionsPerPage?: number
  } = {}
): ArchiveExamData {
  const examId = overrides.examId ?? generateId()
  const pageCount = overrides.pageCount ?? 1
  const cropRegionsPerPage = overrides.cropRegionsPerPage ?? 2

  const examPages = Array.from({ length: pageCount }, (_, i) => ({
    id: generateId(),
    examId,
    pageNumber: i + 1,
    imagePath: `exams/${examId}/master-images/page${i + 1}.png`,
    pageSize: "A4",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  const cropRegions = examPages.flatMap((page, pageIndex) =>
    Array.from({ length: cropRegionsPerPage }, (_, regionIndex) => ({
      id: generateId(),
      examPageId: page.id,
      label: `問${pageIndex * cropRegionsPerPage + regionIndex + 1}`,
      type: "QUESTION_ANSWER",
      x: 0,
      y: regionIndex * 100,
      width: 200,
      height: 80,
      points: 10,
      orderIndex: pageIndex * cropRegionsPerPage + regionIndex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  )

  return {
    exam: {
      id: examId,
      examName: overrides.examName ?? "テスト試験",
      referenceDate: new Date().toISOString(),
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    examPages,
    cropRegions,
    pageImages: [],
    studentAnswerImages: [],
    examStudents: [],
    userExams: [],
    examSubtotalGroups: [],
    examClassrooms: [],
  }
}

export function createArchiveSubtotalsData(
  groups: Array<{
    id?: string
    name?: string
    subtotals?: Array<{ id?: string; name?: string; order?: number }>
  }> = []
): ArchiveSubtotalsData {
  const subtotalGroups = groups.map((group, i) => ({
    id: group.id ?? generateId(),
    name: group.name ?? `小計グループ${i + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  const subtotals = groups.flatMap((group, groupIndex) =>
    (group.subtotals ?? []).map((subtotal, subtotalIndex) => ({
      id: subtotal.id ?? generateId(),
      name: subtotal.name ?? `小計${subtotalIndex + 1}`,
      subtotalGroupId: subtotalGroups[groupIndex].id,
      order: subtotal.order ?? subtotalIndex,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  )

  return {
    subtotalGroups,
    subtotals,
    cropSubtotals: [],
  }
}

export function createArchiveScoresData(
  scores: Array<{
    id?: string
    cropRegionId: string
    examStudentId: string
    status?: string
    partialScore?: string | null
    comment?: string
    userId?: string
  }> = []
): ArchiveScoresData {
  return {
    questionScores: scores.map((score) => ({
      id: score.id ?? generateId(),
      cropRegionId: score.cropRegionId,
      examStudentId: score.examStudentId,
      partialScore: score.partialScore ?? null,
      status: score.status ?? "unscored",
      comment: score.comment ?? "",
      userId: score.userId ?? generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    drawingAnnotations: [],
  }
}

function createArchiveTagsData(): ArchiveTagsData {
  return {
    tags: [],
    tagSubtotalGroups: [],
    examTags: [],
  }
}

// =============================================================================
// ExtractedArchiveData 生成
// =============================================================================

export function createExtractedArchiveData(
  overrides: {
    examData?: ArchiveExamData
    studentsData?: ArchiveStudentsData
    classesData?: ArchiveClassesData
    usersData?: ArchiveUsersData
    subtotalsData?: ArchiveSubtotalsData
    scoresData?: ArchiveScoresData
    tagsData?: ArchiveTagsData
  } = {}
): ExtractedArchiveData {
  return {
    manifest: {
      version: "1.10.0",
      schemaVersion: "test",
      appVersion: "0.4.9-alpha.0",
      exportedAt: new Date().toISOString(),
      examId: overrides.examData?.exam.id ?? generateId(),
      examName: "テスト",
      counts: {
        students: 0,
        classrooms: 0,
        users: 0,
        pages: 0,
        regions: 0,
        scores: 0,
        annotations: 0,
        subtotalGroups: 0,
        masterImages: 0,
        answerSheetImages: 0,
      },
    },
    examData: overrides.examData ?? createArchiveExamData(),
    studentsData: overrides.studentsData ?? createArchiveStudentsData(),
    classesData: overrides.classesData ?? createArchiveClassesData(),
    usersData: overrides.usersData ?? createArchiveUsersData(),
    subtotalsData: overrides.subtotalsData ?? createArchiveSubtotalsData(),
    scoresData: overrides.scoresData ?? createArchiveScoresData(),
    subjectsData: { subjects: [], subjectSubtotalGroups: [] },
    tagsData: overrides.tagsData ?? createArchiveTagsData(),
    transformWarnings: [],
    tempDir: "/tmp/test-archive",
    masterImagePaths: [],
    answerSheetPaths: [],
  }
}

// =============================================================================
// PreMatchingResult / FileOverviewData 生成
// =============================================================================

export function createMatchedItem(
  overrides: Partial<MatchedItem> = {}
): MatchedItem {
  return {
    importId: overrides.importId ?? generateId(),
    existingId: overrides.existingId ?? generateId(),
    importData: overrides.importData ?? {},
    existingData: overrides.existingData ?? {},
    displayLabel: overrides.displayLabel ?? "テスト",
    matchReason: overrides.matchReason ?? "ID一致",
  }
}

export function createPreMatchingResult(
  overrides: Partial<PreMatchingResult> = {}
): PreMatchingResult {
  return {
    byId: overrides.byId ?? [],
    byStudentNumber: overrides.byStudentNumber,
    byName: overrides.byName,
    noMatch: overrides.noMatch ?? [],
  }
}

export function createFileOverviewData(
  overrides: Partial<FileOverviewData> = {}
): FileOverviewData {
  return {
    student: overrides.student ?? createPreMatchingResult(),
    classroom: overrides.classroom ?? createPreMatchingResult(),
    subtotalGroup: overrides.subtotalGroup ?? createPreMatchingResult(),
    user: overrides.user,
    exam: overrides.exam,
    scoringConflicts: overrides.scoringConflicts,
  }
}

/**
 * 採点者が「同じパソコンで作ったデータ」として自動で紐づく事前照合結果。
 *
 * 採点行の同一性は (設問, 受験者, 採点者) の3つ組なので、採点を扱うテストは
 * 採点者の照合結果も渡す必要がある（本番では performPreMatching が必ず埋める）。
 */
export function createUserPreMatchingResult(
  userIds: string[]
): PreMatchingResult {
  return createPreMatchingResult({
    byId: userIds.map((userId) =>
      createMatchedItem({ importId: userId, existingId: userId })
    ),
  })
}

// =============================================================================
// ID統合設定 生成
// =============================================================================

export function createIdIntegrationConfig(
  overrides: Partial<IdIntegrationConfig> = {}
): IdIntegrationConfig {
  return {
    student: overrides.student ?? {
      strategy: "by_student_number",
      decisions: [],
    },
    classroom: overrides.classroom ?? { strategy: "by_name", decisions: [] },
    subtotalGroup: overrides.subtotalGroup ?? {
      strategy: "by_name",
      decisions: [],
    },
    user: overrides.user ?? { strategy: "by_username", decisions: [] },
    exam: overrides.exam,
  }
}

export function createDecision(
  overrides: Partial<IdIntegrationDecision>
): IdIntegrationDecision {
  return {
    importId: overrides.importId ?? generateId(),
    decisionType: overrides.decisionType ?? "create_new",
    existingId: overrides.existingId,
    idChoice: overrides.idChoice,
  }
}

// =============================================================================
// IDマッピング
// =============================================================================

export function createEmptyIdMappings(): IdMappings {
  return {
    student: {},
    classroom: {},
    subtotalGroup: {},
    subtotal: {},
    exam: {},
    examPage: {},
    cropRegion: {},
    studentAnswerImage: {},
    examStudent: {},
    userExam: {},
    cropSubtotal: {},
    questionScore: {},
    drawingAnnotation: {},
    membership: {},
    cropRegionOmrConfig: {},
    cropRegionOmrChoiceOption: {},
    compoundAnswer: {},
    compoundAnswerMember: {},
    compoundAnswerScore: {},
    scoreDecision: {},
    user: {},
  }
}

export function createEmptyImportCounts(): ImportCounts {
  return {
    created: createEmptyCounts(),
    updated: createEmptyCounts(),
    skipped: createEmptyCounts(),
    unchanged: createEmptyCounts(),
  }
}

// =============================================================================
// 採点競合データ
// =============================================================================

export function createScoringConflict(
  overrides: Partial<ScoringConflict> = {}
): ScoringConflict {
  return {
    importScoreId: overrides.importScoreId ?? generateId(),
    existingScoreId: overrides.existingScoreId ?? generateId(),
    studentName: overrides.studentName ?? "テスト生徒",
    studentId: overrides.studentId ?? generateId(),
    questionLabel: overrides.questionLabel ?? "問1",
    cropRegionId: overrides.cropRegionId ?? generateId(),
    importScore: overrides.importScore ?? {
      status: "correct",
      partialScore: 10,
      updatedAt: new Date("2025-07-01").toISOString(),
    },
    existingScore: overrides.existingScore ?? {
      status: "incorrect",
      partialScore: 0,
      updatedAt: new Date("2025-06-01").toISOString(),
    },
    maxPoints: overrides.maxPoints ?? 10,
  }
}
