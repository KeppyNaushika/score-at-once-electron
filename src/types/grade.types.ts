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
  type: string // "exam_total" | "subtotal" | "crop_region" | "coursework" | "coursework_total"
  examId: string | null
  subtotalId: string | null
  cropRegionId: string | null
  courseworkItemId: string | null
  courseworkId: string | null
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
  /** coursework_total型が参照する資料（全評価項目を合算する対象） */
  coursework: { id: string; name: string } | null
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

// ─────────────────────────────────────────────────────────────
// 観点間の制約ルール（不適切な観点/評定の組合せを検知して着色）
// ─────────────────────────────────────────────────────────────

/** 制約ルールの種別 */
export type GradeConstraintKind =
  | "consistency" // 観点集計と評定の整合（Excel流: A=5,B=3,C=1の平均など）
  | "mutual_exclusion" // 特定ラベルの混在禁止（A・C混在など）
  | "expression" // 上級者向け自由記述式

/** 整合ルールの設定 */
export interface ConsistencyConfig {
  /** ラベル→数値の対応（例 { A: 5, B: 3, C: 1 }） */
  labelValues: Record<string, number>
  /** 観点の集計方法 */
  aggregate: "average" | "sum"
  /** 許容する評定との差（これを超えたら違反） */
  tolerance: number
  /**
   * 比較先の「評定」にあたる GradeItem 名（例「評定」）。
   * その項目を評定とみなし、下の viewpointItems を集計して比較する。
   */
  target: string
  /**
   * 集計対象の観点 GradeItem 名の配列（例 知識・技能／思考・判断・表現／態度）。
   * 空/未指定なら target 以外の全 GradeItem を対象にする。
   */
  viewpointItems?: string[]
}

/** 混在禁止ルールの設定 */
export interface MutualExclusionConfig {
  /** 同時に現れてはいけないラベル集合（例 ["A", "C"]） */
  labels: string[]
}

/** DBに保存される制約ルール1件 */
export interface GradeConstraintData {
  id: string
  gradeId: string
  name: string
  kind: GradeConstraintKind
  /** kind別の設定JSON文字列（ConsistencyConfig / MutualExclusionConfig） */
  config: string
  /** kind="expression" 時の式 */
  expression: string
  color: string
  message: string | null
  enabled: boolean
  order: number
}

/** 制約ルールの作成・更新入力 */
export interface GradeConstraintInput {
  name: string
  kind: GradeConstraintKind
  config: string
  expression: string
  color: string
  message: string | null
  enabled: boolean
  order: number
}

/** 1生徒×1ルールの違反結果 */
export interface ConstraintViolation {
  constraintId: string
  name: string
  color: string
  message: string | null
}
