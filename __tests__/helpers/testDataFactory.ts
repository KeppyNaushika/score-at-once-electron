/**
 * テストデータファクトリ
 *
 * テスト用のアーカイブデータ、Prismaレコード、ID統合設定を生成するヘルパー
 */

import { randomUUID } from "crypto"

import type {
  IdMappings,
  ImportCounts,
} from "../../electron-src/lib/import/merge/types"
import { createEmptyCounts } from "../../electron-src/lib/import/merge/types"
import type { ExtractedArchiveData } from "../../electron-src/lib/import/project-archive/archiveExtractor"
import type {
  ArchiveClassesData,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubjectsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
  FileOverviewData,
  IdIntegrationConfig,
  IdIntegrationDecision,
  MatchedItem,
  PreMatchingResult,
  ScoringConflict,
  ScoringConflictConfig,
} from "../../types/projectArchive.types"

// =============================================================================
// 基本ID生成
// =============================================================================

export function generateId(): string {
  return randomUUID()
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
    students: students.map((s, i) => ({
      id: s.id ?? generateId(),
      studentNumber: s.studentNumber ?? `S${String(i + 1).padStart(3, "0")}`,
      lastName: s.lastName ?? `姓${i + 1}`,
      firstName: s.firstName ?? `名${i + 1}`,
      lastNameKana: s.lastNameKana ?? `セイ${i + 1}`,
      firstNameKana: s.firstNameKana ?? `メイ${i + 1}`,
      enrollmentYear: s.enrollmentYear ?? 2024,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

export function createArchiveClassesData(
  classes: Array<{
    id?: string
    name?: string
    classCode?: string | null
    grade?: number | null
  }> = [],
  memberships: Array<{
    id?: string
    studentId: string
    classId: string
    attendanceNumber?: number | null
  }> = []
): ArchiveClassesData {
  return {
    classes: classes.map((c, i) => ({
      id: c.id ?? generateId(),
      name: c.name ?? `クラス${i + 1}`,
      classCode: c.classCode ?? null,
      grade: c.grade ?? null,
      description: null,
      isVisible: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    memberships: memberships.map((m) => ({
      id: m.id ?? generateId(),
      studentId: m.studentId,
      classId: m.classId,
      startDate: new Date().toISOString(),
      endDate: null,
      attendanceNumber: m.attendanceNumber ?? null,
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
    users: users.map((u, i) => ({
      id: u.id ?? generateId(),
      username: u.username ?? `user${i + 1}`,
      name: u.name ?? `ユーザー${i + 1}`,
      role: u.role ?? "teacher",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

export function createArchiveProjectData(
  overrides: {
    projectId?: string
    examName?: string
    pageCount?: number
    cropRegionsPerPage?: number
  } = {}
): ArchiveProjectData {
  const projectId = overrides.projectId ?? generateId()
  const pageCount = overrides.pageCount ?? 1
  const cropRegionsPerPage = overrides.cropRegionsPerPage ?? 2

  const projectPages = Array.from({ length: pageCount }, (_, i) => ({
    id: generateId(),
    projectId,
    pageNumber: i + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  const cropRegions = projectPages.flatMap((page, pi) =>
    Array.from({ length: cropRegionsPerPage }, (_, ri) => ({
      id: generateId(),
      projectPageId: page.id,
      label: `問${pi * cropRegionsPerPage + ri + 1}`,
      type: "QUESTION",
      x: 0,
      y: ri * 100,
      width: 200,
      height: 80,
      points: 10,
      orderIndex: pi * cropRegionsPerPage + ri,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
  )

  return {
    project: {
      id: projectId,
      examName: overrides.examName ?? "テスト試験",
      examDate: new Date().toISOString(),
      subject: "数学",
      description: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    projectPages,
    cropRegions,
    pageImages: [],
    masterImages: [],
    studentAnswerImages: [],
    projectStudents: [],
    userProjects: [],
    projectSubtotalGroups: [],
    projectClasses: [],
  }
}

export function createArchiveSubtotalsData(
  groups: Array<{
    id?: string
    name?: string
    subtotals?: Array<{ id?: string; name?: string; order?: number }>
  }> = []
): ArchiveSubtotalsData {
  const subtotalGroups = groups.map((g, i) => ({
    id: g.id ?? generateId(),
    name: g.name ?? `小計グループ${i + 1}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  const subtotals = groups.flatMap((g, gi) =>
    (g.subtotals ?? []).map((s, si) => ({
      id: s.id ?? generateId(),
      name: s.name ?? `小計${si + 1}`,
      subtotalGroupId: subtotalGroups[gi].id,
      order: s.order ?? si,
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
    studentId: string
    status?: string
    partialScore?: string | null
    userId?: string
  }> = []
): ArchiveScoresData {
  return {
    questionScores: scores.map((s) => ({
      id: s.id ?? generateId(),
      cropRegionId: s.cropRegionId,
      studentId: s.studentId,
      partialScore: s.partialScore ?? null,
      status: s.status ?? "unscored",
      userId: s.userId ?? generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
    drawingAnnotations: [],
  }
}

export function createArchiveSubjectsData(): ArchiveSubjectsData {
  return {
    subjects: [],
    subjectSubtotalGroups: [],
  }
}

// =============================================================================
// ExtractedArchiveData 生成
// =============================================================================

export function createExtractedArchiveData(
  overrides: {
    projectData?: ArchiveProjectData
    studentsData?: ArchiveStudentsData
    classesData?: ArchiveClassesData
    usersData?: ArchiveUsersData
    subtotalsData?: ArchiveSubtotalsData
    scoresData?: ArchiveScoresData
    subjectsData?: ArchiveSubjectsData
  } = {}
): ExtractedArchiveData {
  return {
    manifest: {
      version: "1.4.0",
      schemaVersion: "test",
      appVersion: "0.4.9-alpha.0",
      exportedAt: new Date().toISOString(),
      projectId: overrides.projectData?.project.id ?? generateId(),
      projectName: "テスト",
      counts: {
        students: 0,
        classes: 0,
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
    projectData: overrides.projectData ?? createArchiveProjectData(),
    studentsData: overrides.studentsData ?? createArchiveStudentsData(),
    classesData: overrides.classesData ?? createArchiveClassesData(),
    usersData: overrides.usersData ?? createArchiveUsersData(),
    subtotalsData: overrides.subtotalsData ?? createArchiveSubtotalsData(),
    scoresData: overrides.scoresData ?? createArchiveScoresData(),
    subjectsData: overrides.subjectsData ?? createArchiveSubjectsData(),
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
    class: overrides.class ?? createPreMatchingResult(),
    subtotalGroup: overrides.subtotalGroup ?? createPreMatchingResult(),
    project: overrides.project,
    scoringConflicts: overrides.scoringConflicts,
  }
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
    class: overrides.class ?? { strategy: "by_name", decisions: [] },
    subtotalGroup: overrides.subtotalGroup ?? {
      strategy: "by_name",
      decisions: [],
    },
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
    class: {},
    subtotalGroup: {},
    subtotal: {},
    project: {},
    projectPage: {},
    cropRegion: {},
    masterImage: {},
    studentAnswerImage: {},
    projectStudent: {},
    userProject: {},
    projectSubtotalGroup: {},
    cropSubtotal: {},
    questionScore: {},
    drawingAnnotation: {},
    membership: {},
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

export function createScoringConflictConfig(
  overrides: Partial<ScoringConflictConfig> = {}
): ScoringConflictConfig {
  return {
    strategy: overrides.strategy ?? "newer_wins",
    manualResolutions: overrides.manualResolutions ?? {},
  }
}
