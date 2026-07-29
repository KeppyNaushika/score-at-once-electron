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
  CourseworkArchiveData,
  CourseworkArchiveManifest,
  CourseworkArchiveVersion,
  CourseworkExternalSections,
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

/** v1.1.0 のアーカイブ全体（現行） */
export type CourseworkArchiveDataV1_1_0 = CourseworkArchiveData

/** 読み込み時点では版が確定していないので、扱いうる版の総和で受ける */
export type AnyCourseworkArchiveData =
  CourseworkArchiveDataV1_0_0 | CourseworkArchiveDataV1_1_0

/** どの版の形かを判定する（manifest.version ではなく実データの形で決める） */
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
  data: CourseworkArchiveDataV1_1_0
  originalVersion: CourseworkArchiveVersion
  finalVersion: CourseworkArchiveVersion
  appliedTransformations: {
    from: CourseworkArchiveVersion
    to: CourseworkArchiveVersion
  }[]
  warnings: string[]
}
