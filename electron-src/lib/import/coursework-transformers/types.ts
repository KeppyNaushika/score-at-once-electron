/**
 * coursework-archive のバージョン変換の型
 *
 * バージョンごとに「アーカイブ全体の形」を宣言し、変換器を V<FROM> → V<TO> として
 * 型付けする。旧バージョンの形の知識はこのディレクトリの中だけに閉じ込め、
 * src/types 側は現行の形（CourseworkArchiveData）だけを持つ。
 *
 * 版が変わらないセクション（外部参照＝生徒・学級・所属・タグ）は共有し、
 * 実際に変わった部分だけを版ごとに書く。
 */

import type {
  ArchiveCourseworkRow,
  CollectedCourseworkData,
  CourseworkArchiveData,
  CourseworkArchiveManifest,
  CourseworkArchiveVersion,
  CourseworkExternalSections,
  CourseworkSections,
} from "../../../../src/types/courseworkArchive.types"
import {
  isLegacyCourseworkTree,
  type LegacyArchiveCourseworkRef,
} from "./legacyShape"

/** v1.0.0 のアーカイブ全体。資料1件を入れ子ツリーへ射影して持っていた */
export interface CourseworkArchiveDataV1_0_0 extends CourseworkExternalSections {
  manifest: CourseworkArchiveManifest
  courseworks: LegacyArchiveCourseworkRef[]
}

/** v1.1.0 の資料の行。実施日のキーが date だった（v1.2.0 で referenceDate へ改名） */
export interface ArchiveCourseworkRowV1_1_0 extends Omit<
  ArchiveCourseworkRow,
  "referenceDate"
> {
  date: string | null
}

/** v1.1.0 のアーカイブ全体。平坦なセクションだが資料の日付キーだけが旧名 */
export interface CourseworkArchiveDataV1_1_0
  extends Omit<CourseworkSections, "courseworks">, CourseworkExternalSections {
  manifest: CourseworkArchiveManifest
  courseworks: ArchiveCourseworkRowV1_1_0[]
}

/**
 * v1.1.0 の収集結果（manifest の代わりに counts を持つ形）。
 * .grade はこの形で資料を内包するので、.grade の旧版の型からも名指せるようにしておく。
 */
export type CollectedCourseworkDataV1_1_0 = Omit<
  CollectedCourseworkData,
  "courseworks"
> & {
  courseworks: ArchiveCourseworkRowV1_1_0[]
}

/**
 * 内包された資料の収集結果。版が確定していない時点（.grade の extractor が読んだ直後）は
 * 資料の版と .grade の版が独立に決まるので、扱いうる形の総和で受ける。
 */
export type AnyCollectedCourseworkData =
  CollectedCourseworkData | CollectedCourseworkDataV1_1_0

/** v1.2.0 のアーカイブ全体（現行） */
export type CourseworkArchiveDataV1_2_0 = CourseworkArchiveData

/** 読み込み時点では版が確定していないので、扱いうる版の総和で受ける */
export type AnyCourseworkArchiveData =
  | CourseworkArchiveDataV1_0_0
  | CourseworkArchiveDataV1_1_0
  | CourseworkArchiveDataV1_2_0

/**
 * v1.1.0 の形（資料の行が旧キー date を持ち、現行キー referenceDate を持たない）か。
 * 資料が1件も無いアーカイブは見分けが付かないので、名乗った版を信じる（false）。
 */
export function isCourseworkArchiveV1_1_0(
  data: AnyCourseworkArchiveData
): data is CourseworkArchiveDataV1_1_0 {
  if (isCourseworkArchiveV1_0_0(data)) return false
  return data.courseworks.some(
    (coursework) => "date" in coursework && !("referenceDate" in coursework)
  )
}

/** どの版の形かを判定する（manifest.version ではなくデータの形で決める） */
export function isCourseworkArchiveV1_0_0(
  data: AnyCourseworkArchiveData
): data is CourseworkArchiveDataV1_0_0 {
  return isLegacyCourseworkTree(data.courseworks)
}

export interface CourseworkTransformResult {
  data: AnyCourseworkArchiveData
  warnings: string[]
}

export interface CourseworkVersionTransformer {
  readonly fromVersion: CourseworkArchiveVersion
  readonly toVersion: CourseworkArchiveVersion
  transform(data: AnyCourseworkArchiveData): CourseworkTransformResult
}

/** チェーン完了後は現行の形であることが保証される */
export interface CourseworkChainTransformResult {
  data: CourseworkArchiveDataV1_2_0
  originalVersion: CourseworkArchiveVersion
  finalVersion: CourseworkArchiveVersion
  appliedTransformations: {
    from: CourseworkArchiveVersion
    to: CourseworkArchiveVersion
  }[]
  warnings: string[]
}
