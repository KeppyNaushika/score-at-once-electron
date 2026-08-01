/**
 * grade-archive のバージョン変換の型
 *
 * バージョンごとに「アーカイブ全体の形」を宣言し、変換器を V<FROM> → V<TO> として
 * 型付けする。旧バージョンの形の知識はこのディレクトリの中だけに閉じ込め、
 * src/types 側は現行の形（GradeArchiveData）だけを持つ。
 *
 * 1.3.0〜1.12.0 は「成績本体を入れ子へ射影し、外部参照を名前で持つ」同一の骨格で、
 * 差分は加算的なフィールド（optional）で表せる。したがって版ごとに型を分けず
 * `LegacyGradeArchiveData` 1つで受け、実際に骨格が変わった 1.12.0 → 1.13.0 だけを
 * 別の型として宣言する。
 */

import type {
  GradeArchiveData,
  GradeArchiveVersion,
} from "../../../../src/types/gradeArchive.types"
import type {
  ArchiveGradeBoundaryRowV1_13_0,
  ArchiveGradeBoundarySetRowV1_13_0,
} from "./legacyShape"
import {
  isLegacyGradeArchiveData,
  type LegacyGradeArchiveData,
} from "./legacyShape"

/** 1.3.0〜1.12.0 のアーカイブ全体（射影形式） */
export type GradeArchiveDataUpTo1_12_0 = LegacyGradeArchiveData

/** 1.13.0 のアーカイブ全体（平坦なセクション。境界は容器セット越しに評価項目を指す） */
export type GradeArchiveDataV1_13_0 = Omit<
  GradeArchiveData,
  "gradeItemBoundaries"
> & {
  gradeBoundarySets: ArchiveGradeBoundarySetRowV1_13_0[]
  gradeBoundaries: ArchiveGradeBoundaryRowV1_13_0[]
}

/** 1.14.0 のアーカイブ全体（現行。境界が評価項目へ直付け） */
export type GradeArchiveDataV1_14_0 = GradeArchiveData

/** 読み込み時点では版が確定していないので、扱いうる版の総和で受ける */
export type AnyGradeArchiveData =
  GradeArchiveDataUpTo1_12_0 | GradeArchiveDataV1_13_0 | GradeArchiveDataV1_14_0

/** どの版の形かを判定する（manifest.version ではなく実データの形で決める） */
export function isGradeArchiveUpTo1_12_0(
  data: AnyGradeArchiveData
): data is GradeArchiveDataUpTo1_12_0 {
  return isLegacyGradeArchiveData(data)
}

/** 境界セットのセクションを持てば 1.13.0 の形 */
export function isGradeArchiveV1_13_0(
  data: AnyGradeArchiveData
): data is GradeArchiveDataV1_13_0 {
  if (isLegacyGradeArchiveData(data)) return false
  const sections = data as { gradeBoundarySets?: unknown }
  return Array.isArray(sections.gradeBoundarySets)
}

export interface GradeTransformResult {
  data: AnyGradeArchiveData
  warnings: string[]
}

export interface GradeVersionTransformer {
  readonly fromVersion: GradeArchiveVersion
  readonly toVersion: GradeArchiveVersion
  transform(data: AnyGradeArchiveData): GradeTransformResult
}

/** チェーン完了後は現行の形であることが保証される */
export interface GradeChainTransformResult {
  data: GradeArchiveDataV1_14_0
  originalVersion: GradeArchiveVersion
  finalVersion: GradeArchiveVersion
  appliedTransformations: {
    from: GradeArchiveVersion
    to: GradeArchiveVersion
  }[]
  warnings: string[]
}
