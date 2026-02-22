/**
 * 成績算出アーカイブ(.grade)の型定義
 */

export interface GradeArchiveManifest {
  version: string
  appVersion: string
  exportedAt: string
  gradeProjectId: string
  gradeProjectName: string
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
  gradeProjectData: ArchiveGradeProjectData
  manualScoresData: ArchiveManualScoresData
  boundariesData: ArchiveBoundariesData
}

export interface ArchiveGradeProjectData {
  gradeProject: {
    name: string
    description: string | null
  }
  gradeItems: ArchiveGradeItem[]
  classRefs: { name: string }[]
  examProjectRefs: {
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
}

export interface ArchiveGradeItem {
  name: string
  order: number
  dataSources: ArchiveDataSource[]
}

export interface ArchiveDataSource {
  type: string // "project_total" | "subtotal" | "crop_region" | "manual"
  name: string
  maxScore: number
  weight: number
  order: number
  examProjectName: string | null
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
  examProjectMatches: {
    examName: string
    found: boolean
    projectId: string | null
  }[]
  studentMatchCount: number
  studentMissingCount: number
}
