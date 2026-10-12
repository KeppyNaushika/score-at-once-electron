import type {
  QuestionScore,
  RubricApplication,
  RubricItem,
} from "@prisma/client"

import type { measureCropRegionInk } from "@/electron-src/lib/aiGrading/sendingImageInspection"
import type { Serialized } from "@/types/prismaExtensions"
import type { ScoringStatus } from "@/types/scoringStatus.types"

/**
 * 点の計算が読む項目の列（境界を越えた RubricItem から。Decimal は数）。
 * 種類・判定は DB の文字列のままで受け、計算の中で値の集合へ絞る
 */
export type RubricScoringItem = Pick<
  Serialized<RubricItem>,
  | "id"
  | "effectKind"
  | "pointDelta"
  | "setStatus"
  | "setScore"
  | "setScaleLevelId"
  | "sortOrder"
  | "createdAt"
>

/** 点の計算が読む設問の列 */
export interface RubricScoringRegion {
  /** CropRegion.scoringMethod（DB の文字列のまま） */
  scoringMethod: string
  /** CropRegion.points（配点。無い設問は null） */
  points: number | null
  /**
   * 設問が今使っている類型表の類型の id（類型方式でない・組が無い設問は空）。
   * ほかの組の類型にする項目（組を替えた前の項目）は類型を決めない
   */
  scaleLevelIds: readonly string[]
}

/** 点の計算が読む採点行の列と、その行の適用 */
export type RubricScoredRow = Pick<
  QuestionScore,
  "id" | "userId" | "overridesRubric"
> & {
  status: ScoringStatus
  partialScore: number | null
  scaleLevelId: string | null
  rubricApplications: Pick<RubricApplication, "rubricItemId">[]
}

/** 1マスの点（QuestionScore の status / partialScore / scaleLevelId に書く値） */
export interface RubricScoreResult {
  status: ScoringStatus
  /** 部分点。判定そのものが点を決めるときは null */
  partialScore: number | null
  /** 類型表の類型（evaluated のときだけ値を持つ） */
  scaleLevelId: string | null
}

/** 答案画像1枚の、この設問の枠1つぶんのインクの測定（朱書きの配置に使う占有グリッド） */
export type RegionInkMeasurementRow = Serialized<
  Awaited<ReturnType<typeof measureCropRegionInk>>
>[number]["regions"][number]
