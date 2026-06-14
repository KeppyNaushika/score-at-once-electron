/**
 * 成績算出アーカイブ(.grade)の型定義
 */

export interface GradeArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  gradeId: string
  gradeName: string
  counts: {
    gradeItems: number
    dataSources: number
    manualScores: number
    boundarySets: number
    boundaries: number
    classes: number
    students: number
  }
}

export interface GradeArchiveData {
  manifest: GradeArchiveManifest
  gradeData: ArchiveGradeData
  manualScoresData: ArchiveManualScoresData
  boundariesData: ArchiveBoundariesData
}

export interface ArchiveGradeData {
  grade: {
    name: string
    description: string | null
    /** 基準日（後方互換: v1.2.0+。古いアーカイブではundefined） */
    referenceDate?: string | null
  }
  /** 成績出力設定（後方互換: v1.2.0+。GradeExportSettingsと1:1） */
  exportSettings?: { settingsJson: string } | null
  gradeItems: ArchiveGradeItem[]
  classRefs: { name: string }[]
  examRefs: {
    examName: string
    examDate: string | null
    dataSourceName: string
  }[]
  studentRefs: {
    studentNumber: string
    className: string | null
    customOrder: number | null
  }[]
  /** GradeItem除外設定（後方互換: optional） */
  gradeItemExclusions?: {
    studentNumber: string
    gradeItemName: string
  }[]
  /** 成績ラベル手動上書き（後方互換: optional） */
  gradeOverrides?: {
    studentNumber: string
    targetType: string
    gradeItemName: string | null
    overrideLabel: string
  }[]
}

export interface ArchiveGradeItem {
  name: string
  order: number
  dataSources: ArchiveDataSource[]
}

export interface ArchiveDataSource {
  type: string // "exam_total" | "subtotal" | "crop_region" | "manual"
  name: string
  maxScore: number
  weight: number
  order: number
  examName: string | null
  subtotalName: string | null
  cropRegionLabel: string | null
  absentMethod?: string
  absentRatio?: number
  absentOffset?: number
  treatExpectedAsMissing?: boolean
  estimationMode?: string
  estimationSourceIds?: string[]
}

export interface ArchiveManualScoresData {
  manualScores: {
    gradeItemName: string
    dataSourceName: string
    studentNumber: string
    score: number | null
  }[]
}

export interface ArchiveBoundariesData {
  boundarySets: {
    targetType: string // "grade_item" | "overall"
    gradeItemName: string | null
    boundaries: {
      label: string
      minPercentage: number
      order: number
    }[]
  }[]
}

export interface GradeArchiveImportPreview {
  manifest: GradeArchiveManifest
  classMatches: { found: boolean; name: string }[]
  examMatches: {
    examName: string
    found: boolean
    examId: string | null
  }[]
  studentMatchCount: number
  studentMissingCount: number
}
