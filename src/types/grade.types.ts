/**
 * 成績算出試験の共有型定義
 *
 * リレーション付きの型はすべて Prisma モデル（`@prisma/client`）から派生する（型規則: Prisma型を最優先）。
 * IPC 境界では electron-src/lib/prisma の serializePrisma() が Decimal を number へ変換し、
 * grade lib の hydrate が仮想 maxScore を付与するため、
 * それらのフィールドのみ Prisma モデルから上書きする（coursework.types.ts と同じパターン）。
 * ネストした select は electron-src/lib/prisma/gradeDataSource.ts の gradeDataSourceInclude と対を成す。
 */

import type {
  Classroom,
  Grade,
  GradeClassroom,
  GradeConstraint,
  GradeConstraintExclusionLabel,
  GradeConstraintLabelValue,
  GradeConstraintViewpoint,
  GradeItem,
  GradeItemBoundary,
  GradeStudent,
  Prisma,
} from "@prisma/client"

import type { gradeSummaryInclude } from "@/electron-src/lib/prisma/grade"
import type { gradeDataSourceInclude } from "@/electron-src/lib/prisma/gradeDataSource"
import type { Serialized } from "@/types/prismaExtensions"

import type { CourseworkLetterScaleData, InputMode } from "./coursework.types"
import { defineStringUnion } from "./stringUnion"

/**
 * 欠測時推定方法。
 * - regression: OLS重回帰。二乗誤差最小＝中心へ縮小（平均回帰）あり。当てやすいが低得点層で甘く出やすい。
 * - equipercentile（順位法）: 他ソースでの平均順位を、当ソース実分布の同順位の点へ変換。分布を保存し縮小しない。
 * - zscore（標準偏差法）: 他ソースでの平均標準得点(±SD)を、当ソースの実平均±SDへ載せ替え。縮小を打ち消す。
 */
const ABSENT_METHODS = [
  "null",
  "zero",
  "average",
  "regression",
  "equipercentile",
  "zscore",
] as const

export type AbsentMethod = (typeof ABSENT_METHODS)[number]

/** 想定外の値は「欠測として扱わない」= null（推定しない）へ倒す */
export const { to: toAbsentMethod } = defineStringUnion(ABSENT_METHODS, "null")

/** 推定ソース選択モード */
const ESTIMATION_MODES = ["all", "selected"] as const

export type EstimationMode = (typeof ESTIMATION_MODES)[number]

export const { to: toEstimationMode } = defineStringUnion(
  ESTIMATION_MODES,
  "all"
)

/**
 * データソース種別の唯一の定義源（SSOT）。
 * `GradeDataSource.type` は SQLite が enum 非対応のため DB 上 `String`。値の集合を型で
 * 保証できるのはこの定義のみで、各所での union 手書き重複は禁止（scoringStatus.types と同方針）。
 *
 * `manual` は Coursework 昇格前の旧型（migration 20260623100000 で既存行は `coursework` へ
 * 変換され、archive も transformer で変換される）。現行 UI は生成しないが、未移行データや
 * 直接生成では現れうるため、値を偽らないよう legacy として列挙する（満点算出は 0 = 不活性）。
 */
const GRADE_DATA_SOURCE_TYPES = [
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
export const { to: toGradeDataSourceType } = defineStringUnion(
  GRADE_DATA_SOURCE_TYPES,
  "manual"
)

/**
 * 一覧が受け取る成績（`grade:getAll` の返り値）。
 *
 * 形の SSOT は取得側の `gradeSummaryInclude`。詳細（GradeWithRelations）と違い、
 * 満点の元データも参照先の表示名も持たない。一覧が読むのは名前・学級・件数と、
 * 次のステップ判定が読む「境界の有無・データソース種別・資料の点数の有無」だけ。
 */
export type GradeSummary = Serialized<
  Prisma.GradeGetPayload<{ include: typeof gradeSummaryInclude }>
>

/** 成績算出試験（リレーション付き） */
export type GradeWithRelations = Grade & {
  gradeClassrooms: (Pick<GradeClassroom, "id" | "classroomId" | "order"> & {
    classroom: Pick<Classroom, "id" | "name">
  })[]
  gradeItems: GradeItemWithDataSources[]
  /** 対象者は行のまま同梱される。件数は `.length` で取る */
  gradeStudents: GradeStudent[]
}

/** 評価項目（リレーション付き）。成績境界は行のまま同梱される */
export type GradeItemWithDataSources = Pick<
  GradeItem,
  "id" | "gradeId" | "name" | "order"
> & {
  dataSources: GradeDataSourceWithRelations[]
  boundaries: GradeBoundaryData[]
}

/**
 * データソースの新規作成入力。
 *
 * 参照先のidは種別ごとに1つだけ使う（`crop_region` なら `cropRegionId` のみ）。
 * 満点は元データから毎回導くため入力に含めない（`weight` は換算満点で別物）。
 */
export interface GradeDataSourceInput {
  gradeItemId: string
  type: GradeDataSourceType
  examId?: string
  subtotalId?: string
  cropRegionId?: string
  courseworkItemId?: string
  courseworkId?: string
  name: string
  weight: number
}

/**
 * 取得側の include が返す形（形の SSOT は `gradeDataSourceInclude`）。
 * 境界が `serializePrisma` を通すので Decimal は number になっている。
 */
type EnrichedGradeDataSource = Serialized<
  Prisma.GradeDataSourceGetPayload<{
    include: typeof gradeDataSourceInclude
  }>
>

/**
 * データソース（リレーション付き）。
 *
 * 参照先（exam / subtotal / cropRegion / coursework / courseworkItem）は include の
 * 出力をそのまま持つ。以前は Pick で列を絞っていたが、それは規約の禁じる縮小射影で、
 * 満点の元データを落とすと renderer 側で算出できなくなる。
 *
 * 差分は「境界での型注入」だけ ── DB 上 String の union 列を実体に合わせて宣言し直す。
 * Decimal → number は `Serialized<>` が担うので、ここで列を数え上げない。
 */
export type GradeDataSourceWithRelations = Omit<
  EnrichedGradeDataSource,
  "type" | "absentMethod" | "estimationMode" | "courseworkItem"
> & {
  type: GradeDataSourceType
  absentMethod: AbsentMethod
  estimationMode: EstimationMode
  /** 仮想フィールド。元データ（設問配点/評価項目満点）からライブ算出して付与される。 */
  maxScore: number
  /**
   * coursework型が参照する評価項目（資料名・項目名・満点・入力モード・変換表）。
   * 点数は行のまま同梱される（「入力に着手済みか」は renderer が `.length` で判定する）。
   */
  courseworkItem:
    | (Omit<
        NonNullable<EnrichedGradeDataSource["courseworkItem"]>,
        "inputMode" | "letterScales"
      > & {
        inputMode: InputMode
        letterScales: CourseworkLetterScaleData[]
      })
    | null
}

/** 境界データ */
export type GradeBoundaryData = Omit<GradeItemBoundary, "minPercentage"> & {
  minPercentage: number
}

/**
 * 成績のセル1つを指す座標（IPC 境界の唯一の定義）。
 *
 * 行の主語は「その成績の対象者」（GradeStudent）であり、人（Student）ではない。
 * 名簿から外された生徒の上書き・確定値・除外設定は存在しえない（#962）。
 *
 * renderer / preload / handler / DB 層の4層が同じ形を書くと、余剰プロパティ検査が
 * 効かず1層だけ直しても typecheck が通ってしまう（実行時にだけ壊れる）。定義はここ1箇所。
 */
export interface GradeCellTarget {
  gradeStudentId: string
  gradeItemId: string
}

/** 成績ラベルの手動上書きの入力。overrideLabel が null なら上書きを削除する */
export interface GradeOverrideInput extends GradeCellTarget {
  overrideLabel: string | null
}

/** 評価項目の除外設定の入力。excluded=false なら除外を解除する */
export interface GradeItemExclusionInput extends GradeCellTarget {
  excluded: boolean
}

/** 生徒別成績結果 */
export interface StudentGradeResult {
  /**
   * その成績の対象者（GradeStudent）の id。上書き・確定・除外の書き込み先はこれで指す。
   * 人の id（studentId）とは別物で、どちらも string なので取り違えても型では捕まらない。
   */
  gradeStudentId: string
  /**
   * 人（Student）の id。学級所属は人に紐づくため、名簿の突き合わせや個票の出力対象の
   * 指定にはこちらを使う。出力用であり DB へは書き戻さない。
   */
  studentId: string
  studentNumber: string
  lastName: string
  firstName: string
  attendanceNumber: number | null
  className: string | null
  /** GradeItemごとの成績。評定もこの中の一項目で、これとは別の「総合」は持たない */
  gradeItemResults: GradeItemResult[]
}

/**
 * 成績値の確定（凍結）情報。そのセルに確定値が適用されているときのみ非 null。
 *
 * 確定済みのとき GradeItemResult の weightedScore / weightedMaxScore / percentage /
 * gradeLabel には確定値が入る。ここにはライブ算出値を並べ、「確定後に元資料や境界が
 * 変わって値が食い違っているか（isStale）」と「解除すると何に戻るか」を示す。
 */
export interface GradeFrozenInfo {
  /** 確定した日時（ISO text） */
  frozenAt: string
  /**
   * 確定後に元資料・境界が変わり、現在のリアルタイム算出値と食い違っているか。
   * 判定は入力のハッシュではなく算出結果そのものの比較で行う（値が動かない変更を
   * 「再確定推奨」と誤って煽らないため。差分の中身をそのまま提示できる利点もある）。
   */
  isStale: boolean
  /** 現在のリアルタイム算出値。確定を解除するとこの値に戻る */
  liveWeightedScore: number | null
  liveWeightedMaxScore: number
  livePercentage: number | null
  liveGradeLabel: string | null
}

/** GradeItem単位の成績結果 */
export interface GradeItemResult {
  gradeItemId: string
  gradeItemName: string
  /** この生徒がこのGradeItemから除外されているか */
  isExcluded: boolean
  /** 全DataSourceのスコアがnullで0点扱いになっているか */
  isAllMissing: boolean
  /**
   * データソース別スコア。確定済みでも内訳は現在の資料から算出したライブ値のまま
   * （確定するのは成績値であって資料の中身ではない）。確定値と内訳が食い違う状態は
   * frozen.isStale で示す。
   */
  sourceScores: SourceScoreResult[]
  /** 重み付け後の合計（確定済みなら確定値） */
  weightedScore: number | null
  weightedMaxScore: number
  percentage: number | null
  /** 実効値。採用順は 確定値 > 手動上書き > 自動算出値 */
  gradeLabel: string | null
  /** 自動算出値（常に設定） */
  originalGradeLabel: string | null
  /** 上書き値（nullなら上書きなし） */
  overrideGradeLabel: string | null
  /** 確定（凍結）情報。未確定なら null */
  frozen: GradeFrozenInfo | null
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
  /**
   * このデータソース（テスト）を実際に受けた生徒の素点分布。
   * 素点がクラスの実態のどこに位置するか（説明責任の判断材料）を内訳表に併記する。
   * 実測（他生徒の非null素点）のみから算出。2名未満は undefined。
   */
  distribution?: EstimationTargetDistribution
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

/** 多重共線性でランク落ち除外された説明変数（従属列） */
export interface EstimationDroppedPredictor {
  /** 除外された GradeDataSource.id（React key 用） */
  id: string
  name: string
  /** 対象生徒の当該ソース素点（除外行にも素点を並べて表示するため保持） */
  value: number
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
  /** 重回帰法の各説明変数の項（採用＝従属でない列のみ） */
  regressionTerms?: EstimationRegressionTerm[]
  /** 多重共線性でランク落ち除外した説明変数（従属列） */
  droppedPredictors?: EstimationDroppedPredictor[]
  /** 重回帰法がaverageにフォールバックした理由（あれば） */
  fallbackReason?: EstimationFallbackReason
  /**
   * 重回帰の当てはまりの相関 R（0〜1）。予測が実力を追える度合い＝縮小率。
   * R が高いほど中心（平均）へ寄りにくく、推定の信頼度が高い。
   */
  correlation?: number
  /**
   * 標準偏差法（zscore）: 他ソースでの平均標準得点（±何SD）。
   * これを当ソースの実平均±SDへ載せ替えて予測する（縮小を打ち消す）。
   */
  standardizedStanding?: number
  /**
   * 順位法（equipercentile）: 他ソースでの平均パーセンタイル（0〜1、上位ほど1）。
   * これを当ソース実分布の同順位の点へ変換して予測する（分布を保存）。
   */
  percentileRank?: number
  /** 標準偏差法・順位法の載せ替え先となる当ソース実測分布の平均 */
  targetMean?: number
  /** 標準偏差法の載せ替え先となる当ソース実測分布の標準偏差 */
  targetStandardDeviation?: number
}

/** 推定対象データソースの実測素点分布（評価者向けの判断材料） */
export interface EstimationTargetDistribution {
  /** 実測がある生徒数（この統計の母数） */
  sampleSize: number
  /** 実測素点の平均 */
  mean: number
  /** 実測素点の標準偏差（母標準偏差） */
  standardDeviation: number
}

/** 成績算出結果全体 */
export interface GradeCalculationResult {
  gradeId: string
  gradeName: string
  classNames: string[]
  /**
   * 評価項目とその内訳列の定義。
   * dataSources は「その評価項目が何列で構成されるか」の唯一の根拠で、出力の列は
   * 必ずここから決める。特定の生徒の sourceScores から列数を導いてはならない
   * （除外された生徒は sourceScores が空になるため、行ごとに列数が食い違う）。
   */
  gradeItems: {
    id: string
    name: string
    order: number
    dataSources: { id: string; name: string }[]
    /**
     * その評価項目の成績境界。表示順として minPercentage 降順で返すが、
     * override 方向の判定は minPercentage と order で行うため配列の並び順に意味は無い。
     * order は境界エディタが振る段階の並びで、**小さいほど上位**。
     */
    boundaries: { label: string; minPercentage: number; order: number }[]
  }[]
  students: StudentGradeResult[]
}

// ─────────────────────────────────────────────────────────────
// 観点間の制約ルール（不適切な観点/評定の組合せを検知して着色）
// ─────────────────────────────────────────────────────────────

/** 制約ルールの種別 */
const GRADE_CONSTRAINT_KINDS = [
  "consistency", // 観点集計と評定の整合（Excel流: A=5,B=3,C=1の平均など）
  "mutual_exclusion", // 特定ラベルの混在禁止（A・C混在など）
  "expression", // 上級者向け自由記述式
] as const

export type GradeConstraintKind = (typeof GRADE_CONSTRAINT_KINDS)[number]

/** 想定外の値は最も素直な整合ルールへ倒す */
export const { to: toGradeConstraintKind } = defineStringUnion(
  GRADE_CONSTRAINT_KINDS,
  "consistency"
)

/** 観点の集計方法 */
const CONSTRAINT_AGGREGATES = ["average", "sum"] as const

export type ConstraintAggregate = (typeof CONSTRAINT_AGGREGATES)[number]

export const { to: toConstraintAggregate } = defineStringUnion(
  CONSTRAINT_AGGREGATES,
  "average"
)

/**
 * DBに保存される制約ルール1件（設定リレーション込み）。
 *
 * 設定は kind 別のJSONではなくリレーションで持つ（issue #1063）。比較先・集計対象は
 * 評価項目への FK なので、項目をリネームしても参照は切れない。
 * expression は kind="expression" 時のみ使う。
 * kind / aggregate は union へ、Decimal は number へ narrowing する。
 */
export type GradeConstraintData = Omit<
  GradeConstraint,
  "kind" | "aggregate" | "tolerance" | "createdAt" | "updatedAt"
> & {
  kind: GradeConstraintKind
  aggregate: ConstraintAggregate
  tolerance: number
  /** 集計対象の観点（空なら比較先以外の全項目が対象という意味になる） */
  viewpoints: Array<
    Pick<GradeConstraintViewpoint, "id" | "gradeItemId" | "order">
  >
  /** ラベル→数値の対応（例 A=5, B=3, C=1） */
  labelValues: Array<
    Pick<GradeConstraintLabelValue, "id" | "label" | "order"> & {
      value: number
    }
  >
  /** 混在禁止ラベル（mutual_exclusion 用） */
  exclusionLabels: Array<
    Pick<GradeConstraintExclusionLabel, "id" | "label" | "order">
  >
}

/**
 * 制約ルールの作成・更新入力。
 * 設定部分（viewpointGradeItemIds / labelValues / exclusionLabels）は指定されたら総入れ替え、
 * 未指定なら据え置き。
 */
export interface GradeConstraintInput {
  name: string
  kind: GradeConstraintKind
  /** 比較先の「評定」にあたる評価項目。未選択なら null */
  targetGradeItemId: string | null
  aggregate: ConstraintAggregate
  /** 許容する評定との差（これを超えたら違反） */
  tolerance: number
  /** 集計対象の観点の評価項目id。空配列なら「比較先以外の全項目」 */
  viewpointGradeItemIds: string[]
  /** ラベル→数値の対応（例 { A: 5, B: 3, C: 1 }） */
  labelValues: Record<string, number>
  /** 同時に現れてはいけないラベル集合（例 ["A", "C"]） */
  exclusionLabels: string[]
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
