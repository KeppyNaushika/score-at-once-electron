/**
 * レンダラテスト用モックデータファクトリ
 */

import type {
  ArchiveDataCounts,
  ArchiveManifest,
  ExamPreMatchingResult,
  FileOverviewData,
  ImportItem,
  MatchedItem,
  PreMatchingResult,
  ScoringConflict,
  ScoringConflictData,
} from "@/types/examArchive.types"

// ---------------------------------------------------------------------------
// ArchiveManifest
// ---------------------------------------------------------------------------

function createMockCounts(
  overrides?: Partial<ArchiveDataCounts>
): ArchiveDataCounts {
  return {
    students: 3,
    classrooms: 1,
    users: 1,
    pages: 2,
    regions: 4,
    scores: 12,
    annotations: 0,
    subtotalGroups: 1,
    masterImages: 2,
    answerSheetImages: 6,
    ...overrides,
  }
}

export function createMockManifest(
  overrides?: Partial<ArchiveManifest>
): ArchiveManifest {
  return {
    version: "1.4.0",
    schemaVersion: "test",
    appVersion: "0.5.0",
    exportedAt: new Date().toISOString(),
    examId: "mock-exam-id",
    examName: "テスト試験",
    counts: createMockCounts(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// PreMatchingResult / FileOverviewData
// ---------------------------------------------------------------------------

function createMockMatchedItem(overrides?: Partial<MatchedItem>): MatchedItem {
  return {
    importId: "import-student-1",
    existingId: "existing-student-1",
    importData: { lastName: "山田", firstName: "太郎", studentNumber: "001" },
    existingData: { lastName: "山田", firstName: "太郎", studentNumber: "001" },
    displayLabel: "山田太郎（001）",
    matchReason: "IDが一致",
    ...overrides,
  }
}

function createMockImportItem(overrides?: Partial<ImportItem>): ImportItem {
  return {
    importId: "import-new-1",
    importData: { lastName: "新規", firstName: "生徒", studentNumber: "099" },
    displayLabel: "新規生徒（099）",
    ...overrides,
  }
}

function createMockPreMatchingResult(opts?: {
  byIdCount?: number
  byStudentNumberCount?: number
  byNameCount?: number
  noMatchCount?: number
}): PreMatchingResult {
  const {
    byIdCount = 2,
    byStudentNumberCount = 0,
    byNameCount = 0,
    noMatchCount = 1,
  } = opts ?? {}

  return {
    byId: Array.from({ length: byIdCount }, (_, i) =>
      createMockMatchedItem({
        importId: `import-id-${i}`,
        existingId: `existing-id-${i}`,
        displayLabel: `ID一致生徒${i + 1}`,
        matchReason: "IDが一致",
      })
    ),
    byStudentNumber: Array.from({ length: byStudentNumberCount }, (_, i) =>
      createMockMatchedItem({
        importId: `import-sn-${i}`,
        existingId: `existing-sn-${i}`,
        displayLabel: `番号一致生徒${i + 1}`,
        matchReason: "学籍番号が一致",
      })
    ),
    byName: Array.from({ length: byNameCount }, (_, i) =>
      createMockMatchedItem({
        importId: `import-name-${i}`,
        existingId: `existing-name-${i}`,
        displayLabel: `氏名一致生徒${i + 1}`,
        matchReason: "氏名が一致",
      })
    ),
    noMatch: Array.from({ length: noMatchCount }, (_, i) =>
      createMockImportItem({
        importId: `import-nomatch-${i}`,
        displayLabel: `不明生徒${i + 1}`,
      })
    ),
  }
}

export function createMockFileOverviewData(
  overrides?: Partial<FileOverviewData>
): FileOverviewData {
  return {
    student: createMockPreMatchingResult(),
    classroom: createMockPreMatchingResult({
      byIdCount: 1,
      noMatchCount: 0,
    }),
    subtotalGroup: createMockPreMatchingResult({
      byIdCount: 1,
      noMatchCount: 0,
    }),
    exam: createMockExamPreMatchingResult(),
    ...overrides,
  }
}

function createMockExamPreMatchingResult(
  overrides?: Partial<ExamPreMatchingResult>
): ExamPreMatchingResult {
  return {
    isIdMatch: true,
    importExamId: "mock-exam-id",
    existingExamId: "mock-exam-id",
    importData: {},
    existingData: {},
    displayLabel: "テスト試験",
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// ScoringConflictData
// ---------------------------------------------------------------------------

function createMockScoringConflict(
  overrides?: Partial<ScoringConflict>
): ScoringConflict {
  return {
    importScoreId: "import-score-1",
    existingScoreId: "existing-score-1",
    studentName: "山田太郎",
    studentId: "student-1",
    questionLabel: "問1",
    cropRegionId: "region-1",
    importScore: {
      status: "correct",
      partialScore: null,
      updatedAt: "2025-07-01T00:00:00.000Z",
    },
    existingScore: {
      status: "incorrect",
      partialScore: null,
      updatedAt: "2025-06-01T00:00:00.000Z",
    },
    maxPoints: 10,
    ...overrides,
  }
}

export function createMockScoringConflictData(opts?: {
  conflictCount?: number
  newCount?: number
  unchangedCount?: number
}): ScoringConflictData {
  const { conflictCount = 0, newCount = 0, unchangedCount = 0 } = opts ?? {}
  return {
    conflictCount,
    newCount,
    unchangedCount,
    conflicts: Array.from({ length: conflictCount }, (_, i) =>
      createMockScoringConflict({
        importScoreId: `import-score-${i}`,
        existingScoreId: `existing-score-${i}`,
      })
    ),
  }
}

// ---------------------------------------------------------------------------
// Import結果サマリー
// ---------------------------------------------------------------------------

export function createMockImportSummary() {
  return {
    created: createMockCounts({ students: 1, scores: 4 }),
    updated: createMockCounts({ students: 0, scores: 0 }),
    skipped: createMockCounts({ students: 0, scores: 0 }),
    unchanged: createMockCounts({ students: 2, scores: 8 }),
  }
}
