/**
 * 成績算出試験の共有型定義
 */

import type { CourseworkItemWithDetails, InputMode } from "./coursework.types"

/** 成績算出試験（リレーション付き） */
export interface GradeWithDetails {
  id: string
  name: string
  description: string | null
  referenceDate: string | null
  createdAt: Date
  updatedAt: Date
  gradeClasses: {
    id: string
    classId: string
    class: { id: string; name: string }
    order: number
  }[]
  gradeItems: GradeItemWithDetails[]
  _count?: {
    gradeItems: number
    gradeStudents: number
    boundarySets: number
  }
}

/** 評価項目（リレーション付き） */
export interface GradeItemWithDetails {
  id: string
  gradeId: string
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
  type: string // "exam_total" | "subtotal" | "crop_region" | "coursework"
  examId: string | null
  subtotalId: string | null
  cropRegionId: string | null
  courseworkItemId: string | null
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
  exam: { id: string; examName: string; examDate: Date | null } | null
  subtotal: { id: string; name: string; order: number } | null
  cropRegion: {
    id: string
    label: string
    points: number | null
  } | null
  /** coursework型が参照する評価項目（資料名・項目名・満点・入力モード・変換表） */
  courseworkItem:
    | (CourseworkItemWithDetails & {
        coursework: { id: string; name: string }
      })
    | null
}

export type { InputMode }

/** 境界セット（境界リスト付き） */
export interface GradeBoundarySetWithDetails {
  id: string
  gradeId: string
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
  gradeId: string
  studentId: string
  gradeItemId: string
}

/** データソース別スコア */
export interface SourceScoreResult {
  dataSourceId: string
  dataSourceName: string
  type: string
  /** 最終スコア（manual型は変換・加減点・クランプ適用後） */
  rawScore: number | null
  maxScore: number
  weight: number
  weightedScore: number | null
  isEstimated: boolean
  /** 文字モード時に入力された評価記号（manual型のみ） */
  letterValue: string | null
  /** 適用された加点・減点（manual型のみ。0なら調整なし） */
  adjustment: number | null
  /** 加減点の理由（manual型のみ） */
  adjustmentReason: string | null
  /** コメント（manual型のみ。成績通知書に表示） */
  comment: string | null
}

/** 成績算出結果全体 */
export interface GradeCalculationResult {
  gradeId: string
  gradeName: string
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
