/**
 * 成績算出プロジェクトの共有型定義
 */

/** 成績算出プロジェクト（リレーション付き） */
export interface GradeProjectWithDetails {
  id: string
  name: string
  description: string | null
  referenceDate: string | null
  createdAt: Date
  updatedAt: Date
  gradeProjectClasses: {
    id: string
    classId: string
    class: { id: string; name: string }
    order: number
  }[]
  gradeItems: GradeItemWithDetails[]
  _count?: {
    gradeItems: number
    gradeProjectStudents: number
    boundarySets: number
  }
}

/** 評価項目（リレーション付き） */
export interface GradeItemWithDetails {
  id: string
  gradeProjectId: string
  name: string
  order: number
  dataSources: GradeDataSourceWithDetails[]
}

/** 欠測時推定方法 */
export type AbsentMethod = "null" | "zero" | "average" | "regression"

/** 推定ソース選択モード */
export type EstimationMode = "all" | "selected"

/** データソース（リレーション付き） */
export interface GradeDataSourceWithDetails {
  id: string
  gradeItemId: string
  type: string // "project_total" | "subtotal" | "crop_region" | "manual"
  examProjectId: string | null
  subtotalId: string | null
  cropRegionId: string | null
  name: string
  maxScore: number
  weight: number
  order: number
  absentMethod: AbsentMethod
  absentRatio: number
  absentOffset: number
  treatExpectedAsMissing: boolean
  estimationMode: EstimationMode
  estimationSourceIds: string[]
  createdAt: Date
  updatedAt: Date
  examProject: { id: string; examName: string; examDate: Date | null } | null
  subtotal: { id: string; name: string; order: number } | null
  cropRegion: {
    id: string
    label: string
    points: number | null
  } | null
  _count?: { manualScores: number }
}

/** 手動スコア（生徒情報付き） */
export interface ManualScoreWithStudent {
  id: string
  gradeDataSourceId: string
  studentId: string
  score: number | null
  student: {
    id: string
    studentNumber: string
    lastName: string
    firstName: string
  }
}

/** 境界セット（境界リスト付き） */
export interface GradeBoundarySetWithDetails {
  id: string
  gradeProjectId: string
  targetType: string // "grade_item" | "overall"
  gradeItemId: string | null
  gradeItem: { id: string; name: string; order: number } | null
  boundaries: GradeBoundaryData[]
}

/** 境界データ */
export interface GradeBoundaryData {
  id: string
  gradeBoundarySetId: string
  label: string
  minPercentage: number
  order: number
}

/** 生徒別成績結果 */
export interface StudentGradeResult {
  studentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  /** GradeItemごとの成績 */
  gradeItemResults: GradeItemResult[]
  /** 総合スコア */
  overallScore: number | null
  overallMaxScore: number
  overallPercentage: number | null
  /** 実効値（上書きがあればそれ、なければ自動算出値） */
  overallGradeLabel: string | null
  /** 自動算出値（常に設定） */
  originalOverallGradeLabel: string | null
  /** 上書き値（nullなら上書きなし） */
  overrideOverallGradeLabel: string | null
}

/** GradeItem単位の成績結果 */
export interface GradeItemResult {
  gradeItemId: string
  gradeItemName: string
  /** この生徒がこのGradeItemから除外されているか */
  isExcluded: boolean
  /** 全DataSourceのスコアがnullで0点扱いになっているか */
  isAllMissing: boolean
  /** データソース別スコア */
  sourceScores: SourceScoreResult[]
  /** 重み付け後の合計 */
  weightedScore: number | null
  weightedMaxScore: number
  percentage: number | null
  /** 実効値（上書きがあればそれ、なければ自動算出値） */
  gradeLabel: string | null
  /** 自動算出値（常に設定） */
  originalGradeLabel: string | null
  /** 上書き値（nullなら上書きなし） */
  overrideGradeLabel: string | null
}

/** GradeItem除外設定データ */
export interface GradeItemExclusionData {
  gradeProjectId: string
  studentId: string
  gradeItemId: string
}

/** データソース別スコア */
export interface SourceScoreResult {
  dataSourceId: string
  dataSourceName: string
  type: string
  rawScore: number | null
  maxScore: number
  weight: number
  weightedScore: number | null
  isEstimated: boolean
}

/** 成績算出結果全体 */
export interface GradeCalculationResult {
  gradeProjectId: string
  gradeProjectName: string
  classNames: string[]
  gradeItems: { id: string; name: string; order: number }[]
  students: StudentGradeResult[]
  /** 境界セットデータ（override方向判定用） */
  boundarySets: {
    targetType: string
    gradeItemId: string | null
    boundaries: { label: string; minPercentage: number }[]
  }[]
}
