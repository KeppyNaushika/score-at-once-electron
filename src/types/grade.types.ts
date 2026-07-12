/**
 * 成績算出試験の共有型定義
 *
 * リレーション付きの型はすべて Prisma モデル（`@prisma/client`）から派生する（型規則: Prisma型を最優先）。
 * IPC 境界では electron-src/lib/prisma の serializePrisma() が Decimal を number へ変換し、
 * grade lib の hydrate が estimationSourceIds を string[] へ正規化し仮想 maxScore を付与するため、
 * それらのフィールドのみ Prisma モデルから上書きする（coursework.types.ts と同じパターン）。
 * 実施日（referenceDate）は string | null とする。
 * ネストした select は electron-src/lib/prisma/gradeDataSource.ts の gradeDataSourceInclude と対を成す。
 */

import type {
  Classroom,
  Coursework,
  CropRegion,
  Exam,
  Grade,
  GradeBoundary,
  GradeBoundarySet,
  GradeClassroom,
  GradeConstraint,
  GradeDataSource,
  GradeItem,
  Subtotal,
} from "@prisma/client"

import type { CourseworkItemWithLetterScales } from "./coursework.types"
import { defineStringUnion } from "./stringUnion"

/** 欠測時推定方法 */
export type AbsentMethod = "null" | "zero" | "average" | "regression"

/** 推定ソース選択モード */
export type EstimationMode = "all" | "selected"

/**
 * データソース種別の唯一の定義源（SSOT）。
 * `GradeDataSource.type` は SQLite が enum 非対応のため DB 上 `String`。値の集合を型で
 * 保証できるのはこの定義のみで、各所での union 手書き重複は禁止（scoringStatus.types と同方針）。
 *
 * `manual` は Coursework 昇格前の旧型（migration 20260623100000 で既存行は `coursework` へ
 * 変換され、archive も transformer で変換される）。現行 UI は生成しないが、未移行データや
 * 直接生成では現れうるため、値を偽らないよう legacy として列挙する（満点算出は 0 = 不活性）。
 */
export const GRADE_DATA_SOURCE_TYPES = [
  "exam_total",
  "subtotal",
  "crop_region",
  "coursework",
  "coursework_total",
  "manual",
] as const

export type GradeDataSourceType = (typeof GRADE_DATA_SOURCE_TYPES)[number]

/**
 * 型ガード `isGradeDataSourceType` と境界コンバータ `toGradeDataSourceType`。
 * 想定外値は不活性な legacy `manual`（満点0・算出ソース無し）へフォールバックする
 * — 満点を捏造する `exam_total` 等へ倒すより安全なため。
 */
export const { is: isGradeDataSourceType, to: toGradeDataSourceType } =
  defineStringUnion(GRADE_DATA_SOURCE_TYPES, "manual")

/**
 * 境界セットの対象種別の唯一の定義源（SSOT）。
 * `GradeBoundarySet.targetType` も DB 上 `String`。観点別（grade_item）か総合（overall）か。
 */
export const GRADE_BOUNDARY_TARGET_TYPES = ["grade_item", "overall"] as const

export type GradeBoundaryTargetType =
  (typeof GRADE_BOUNDARY_TARGET_TYPES)[number]

/**
 * 型ガード `isGradeBoundaryTargetType` と境界コンバータ `toGradeBoundaryTargetType`
 * （想定外値は grade_item）。targetType は grade_item|overall の2値ハード不変。
 */
export const { is: isGradeBoundaryTargetType, to: toGradeBoundaryTargetType } =
  defineStringUnion(GRADE_BOUNDARY_TARGET_TYPES, "grade_item")

/** 成績算出試験（リレーション付き） */
export type GradeWithRelations = Omit<Grade, "referenceDate"> & {
  referenceDate: string | null
  gradeClassrooms: (Pick<GradeClassroom, "id" | "classroomId" | "order"> & {
    classroom: Pick<Classroom, "id" | "name">
  })[]
  gradeItems: GradeItemWithDataSources[]
  _count?: {
    gradeItems: number
    gradeStudents: number
    boundarySets: number
  }
}

/** 評価項目（リレーション付き） */
export type GradeItemWithDataSources = Pick<
  GradeItem,
  "id" | "gradeId" | "name" | "order"
> & {
  dataSources: GradeDataSourceWithRelations[]
}

/** データソース（リレーション付き） */
export type GradeDataSourceWithRelations = Omit<
  GradeDataSource,
  | "type"
  | "weight"
  | "absentMethod"
  | "absentRatio"
  | "absentOffset"
  | "estimationMode"
  | "estimationSourceIds"
> & {
  type: GradeDataSourceType
  weight: number
  absentMethod: AbsentMethod
  absentRatio: number
  absentOffset: number
  estimationMode: EstimationMode
  estimationSourceIds: string[]
  /** 仮想フィールド。元データ（設問配点/評価項目満点）からライブ算出して付与される。 */
  maxScore: number
  exam: Pick<Exam, "id" | "examName" | "examDate"> | null
  subtotal: Pick<Subtotal, "id" | "name" | "order"> | null
  cropRegion: Pick<CropRegion, "id" | "label" | "points"> | null
  /** coursework型が参照する評価項目（資料名・項目名・満点・入力モード・変換表） */
  courseworkItem:
    | (CourseworkItemWithLetterScales & {
        coursework: Pick<Coursework, "id" | "name">
      })
    | null
  /** coursework_total型が参照する資料（全評価項目を合算する対象） */
  coursework: Pick<Coursework, "id" | "name"> | null
}

/** 境界セット（境界リスト付き） */
export type GradeBoundarySetWithItemAndBoundaries = Omit<
  Pick<GradeBoundarySet, "id" | "gradeId" | "targetType" | "gradeItemId">,
  "targetType"
> & {
  targetType: GradeBoundaryTargetType
  gradeItem: Pick<GradeItem, "id" | "name" | "order"> | null
  boundaries: GradeBoundaryData[]
}

/** 境界データ */
export type GradeBoundaryData = Omit<
  GradeBoundary,
  "minPercentage" | "createdAt" | "updatedAt"
> & {
  minPercentage: number
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

/** データソース別スコア */
export interface SourceScoreResult {
  dataSourceId: string
  dataSourceName: string
  type: GradeDataSourceType
  /** 最終スコア（manual型は変換・加減点・クランプ適用後） */
  rawScore: number | null
  maxScore: number
  weight: number
  weightedScore: number | null
  isEstimated: boolean
  /** 欠測推定の内訳（isEstimated=true のときのみ。どの方法・式で推定したか） */
  estimation: EstimationDetail | null
  /** 文字モード時に入力された評価記号（manual型のみ） */
  letterValue: string | null
  /** 適用された加点・減点（manual型のみ。0なら調整なし） */
  adjustment: number | null
  /** 加減点の理由（manual型のみ） */
  adjustmentReason: string | null
  /** コメント（manual型のみ。成績通知書に表示） */
  comment: string | null
}

/** 平均比率法で使用した1ソースの寄与（score/maxScore = ratio） */
export interface EstimationSourceContribution {
  /** 元ソースの GradeDataSource.id（表示名は衝突しうるため React key はこれを使う） */
  id: string
  name: string
  score: number
  maxScore: number
  ratio: number
}

/** 重回帰法の1説明変数の項（coefficient × value） */
export interface EstimationRegressionTerm {
  /** 説明変数となった GradeDataSource.id（React key 用） */
  id: string
  name: string
  value: number
  coefficient: number
}

/** 重回帰法がフォールバックした理由 */
export type EstimationFallbackReason =
  "insufficient_samples" | "singular_matrix"

/**
 * 欠測推定の内訳。
 * 「どの方法で・どのソースから・どんな式で推定したか」を結果画面のpopoverに表示するために持つ。
 */
export interface EstimationDetail {
  /**
   * 実際に使われた推定方法（regressionがサンプル不足/特異行列でaverageに落ちた場合は"average"）。
   * 設定された方法との差異は fallbackReason で表す。
   */
  effectiveMethod: AbsentMethod
  /** 推定素点（乗率・加減点の適用前、内部クランプ済み） */
  baseEstimate: number
  /** 乗率 */
  ratio: number
  /** 加減点 */
  offset: number
  /** 乗率・加減点を適用した値（クランプ前）。= baseEstimate × ratio + offset */
  adjustedScore: number
  /** 最終スコア（= clamp(adjustedScore)。SourceScoreResult.rawScoreと同値） */
  finalScore: number
  /** 平均比率法（重回帰のフォールバック含む）で使用したソース内訳 */
  averageSources?: EstimationSourceContribution[]
  /** 平均比率法の平均比率 */
  averageRatio?: number
  /** 重回帰法の切片（β0） */
  intercept?: number
  /** 重回帰法の各説明変数の項 */
  regressionTerms?: EstimationRegressionTerm[]
  /** 重回帰法がaverageにフォールバックした理由（あれば） */
  fallbackReason?: EstimationFallbackReason
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
    targetType: GradeBoundaryTargetType
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

/**
 * DBに保存される制約ルール1件。
 * config は kind別の設定JSON文字列（ConsistencyConfig / MutualExclusionConfig）、
 * expression は kind="expression" 時の式。kind のみ union へ narrowing する。
 */
export type GradeConstraintData = Omit<
  GradeConstraint,
  "kind" | "createdAt" | "updatedAt"
> & {
  kind: GradeConstraintKind
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
