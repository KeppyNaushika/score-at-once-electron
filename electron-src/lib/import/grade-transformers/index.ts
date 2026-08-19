/**
 * grade-archive バージョン変換器
 *
 * 旧バージョンのアーカイブを現行（1.13.0＝テーブルごとの平坦なセクション）へ正規化する。
 *
 * 【検出は manifest.version ではなくデータ形状ベース】
 * grade はバージョン履歴が入り組んでおり（1.3.0 の manual / 1.4.0 の名前ベース /
 * 1.5.0 以降の UUIDベース）、旧アーカイブの version 表記が不正確な場合がある。
 * そこで「どのフィールドを持っているか」で適用する変換器を決める:
 *   - manual 型 DataSource あり        → 1.3.0 → 1.4.0（manual を名前ベース資料へ。
 *                                        点数の有無に関わらず変換し "manual" 型を残さない）
 *   - courseworks（名前ベース配列）あり → 1.4.0 → 1.5.0（入れ子形式の内包資料へ）
 *   - 境界セット/上書きに targetType あり → 1.9.0 → 1.10.0（総合エントリを破棄）
 *   - 制約ルールに config あり          → 1.10.0 → 1.11.0（設定JSONを構造化）
 *   - 内包資料が入れ子形式             → 1.11.0 → 1.12.0（平坦なセクションへ）
 *   - gradeData を持つ（射影形式）      → 1.12.0 → 1.13.0（成績本体も平坦なセクションへ）
 *   - 境界セットのセクションあり        → 1.13.0 → 1.14.0（境界を評価項目へ直付け）
 *   - 出力設定が JSON 1本のセクション   → 1.14.0 → 1.15.0（出力設定を列へ割る）
 * 1.6.0〜1.9.0 は加算的な変更のみで、専用の transformer は持たない。
 */

import type { GradeArchiveVersion } from "../../../../src/types/gradeArchive.types"
import { GRADE_CURRENT_VERSION } from "../../../../src/types/gradeArchive.types"
import { isLegacyCollectedCourseworkData } from "../coursework-transformers/legacyShape"
import type { LegacyGradeArchiveData } from "./legacyShape"
import type { AnyGradeArchiveData, GradeChainTransformResult } from "./types"
import {
  isGradeArchiveUpTo1_12_0,
  isGradeArchiveV1_13_0,
  isGradeArchiveV1_14_0,
} from "./types"
import { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
import { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"
import { V1_9_0_to_V1_10_0_Transformer } from "./V1_9_0_to_V1_10_0"
import { V1_10_0_to_V1_11_0_Transformer } from "./V1_10_0_to_V1_11_0"
import { V1_11_0_to_V1_12_0_Transformer } from "./V1_11_0_to_V1_12_0"
import { V1_12_0_to_V1_13_0_Transformer } from "./V1_12_0_to_V1_13_0"
import { V1_13_0_to_V1_14_0_Transformer } from "./V1_13_0_to_V1_14_0"
import { V1_14_0_to_V1_15_0_Transformer } from "./V1_14_0_to_V1_15_0"

const v1_3_0 = new V1_3_0_to_V1_4_0_Transformer()
const v1_4_0 = new V1_4_0_to_V1_5_0_Transformer()
const v1_9_0 = new V1_9_0_to_V1_10_0_Transformer()
const v1_10_0 = new V1_10_0_to_V1_11_0_Transformer()
const v1_11_0 = new V1_11_0_to_V1_12_0_Transformer()
const v1_12_0 = new V1_12_0_to_V1_13_0_Transformer()
const v1_13_0 = new V1_13_0_to_V1_14_0_Transformer()
const v1_14_0 = new V1_14_0_to_V1_15_0_Transformer()

/**
 * 総合（overall）の名残を持つか。境界セット・手動上書きのどちらかに targetType があるか、
 * 対象評価項目名を持たないエントリがあれば 1.9.0 以前の形。
 */
function hasOverallResidue(data: LegacyGradeArchiveData): boolean {
  const boundaryResidue = data.boundariesData.boundarySets.some(
    (boundarySet) =>
      boundarySet.targetType !== undefined || boundarySet.gradeItemName === null
  )
  const overrideResidue = (data.gradeData.gradeOverrides ?? []).some(
    (gradeOverride) =>
      gradeOverride.targetType !== undefined ||
      gradeOverride.gradeItemName === null
  )
  return boundaryResidue || overrideResidue
}

/** 制約ルールが旧 config（設定JSON）を持つか。持てば 1.10.0 以前の形 */
function hasLegacyConstraintConfig(data: LegacyGradeArchiveData): boolean {
  return (data.gradeData.gradeConstraints ?? []).some(
    (gradeConstraint) => gradeConstraint.config !== undefined
  )
}

/** manual 型 DataSource を持つか（点数未入力でも true） */
function hasManualDataSource(data: LegacyGradeArchiveData): boolean {
  return data.gradeData.gradeItems.some((gradeItem) =>
    gradeItem.dataSources.some((dataSource) => dataSource.type === "manual")
  )
}

/**
 * データ形状から元バージョンを推定（報告用）。
 * 総合の名残の判定は外部成績の形より先に見る — courseworkArchive を持つ 1.9.0 でも
 * 総合エントリが残っていれば元は 1.9.0 であり、現行版と報告してはいけない
 * （appliedTransformations に 1.9.0→1.10.0 を積みながら originalVersion=1.10.0 という矛盾になる）。
 */
function detectOriginalVersion(data: AnyGradeArchiveData): GradeArchiveVersion {
  if (!isGradeArchiveUpTo1_12_0(data)) return detectFlatVersion(data)
  if (data.courseworks) return "1.4.0"
  if (hasManualDataSource(data) || data.manualScoresData) return "1.3.0"
  if (hasOverallResidue(data)) return "1.9.0"
  if (hasLegacyConstraintConfig(data)) return "1.10.0"
  // 内包資料が入れ子形式なら 1.5.0〜1.11.0 のいずれか。この形だけでは区別できないので
  // 上限の 1.11.0 と報告する（既存の粒度と同じ）
  if (isLegacyCollectedCourseworkData(data.legacyCourseworkArchive)) {
    return "1.11.0"
  }
  return "1.12.0"
}

/** 平坦なセクションのうち、どの形かは残っている旧セクションで見分ける */
function detectFlatVersion(data: AnyGradeArchiveData): GradeArchiveVersion {
  if (isGradeArchiveV1_13_0(data)) return "1.13.0"
  if (isGradeArchiveV1_14_0(data)) return "1.14.0"
  return GRADE_CURRENT_VERSION
}

/**
 * grade アーカイブを現行バージョンへ正規化する。
 * 完了後は必ず平坦なセクションの形になり、importer は単一経路で処理できる。
 */
export function transformGradeToLatest(
  data: AnyGradeArchiveData
): GradeChainTransformResult {
  let current = data
  const warnings: string[] = []
  const originalVersion = detectOriginalVersion(data)
  const appliedTransformations: GradeChainTransformResult["appliedTransformations"] =
    []

  /**
   * 旧形状のうち条件に合うものだけへ変換器を当てる。
   * 変換器は旧形状しか受け取らないので、現行形になった時点でどれも当たらなくなる。
   */
  const applyIf = (
    shouldApply: (candidate: LegacyGradeArchiveData) => boolean,
    transformer: {
      transform: (input: LegacyGradeArchiveData) => {
        data: AnyGradeArchiveData
        warnings: string[]
      }
    },
    from: GradeArchiveVersion,
    to: GradeArchiveVersion
  ): void => {
    if (!isGradeArchiveUpTo1_12_0(current)) return
    if (!shouldApply(current)) return
    const result = transformer.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from, to })
  }

  const hasCoursework = (candidate: LegacyGradeArchiveData) =>
    Boolean(candidate.courseworkArchive || candidate.legacyCourseworkArchive)

  // 1.3.0 → 1.4.0: manual 型の外部成績を名前ベース資料へ
  //   点数の有無に関わらず、manual 型 DataSource が残らないよう変換する。
  applyIf(
    (candidate) => !hasCoursework(candidate) && hasManualDataSource(candidate),
    v1_3_0,
    "1.3.0",
    "1.4.0"
  )

  // 1.4.0 → 1.5.0: 名前ベース資料を入れ子形式の内包資料へ（空配列でも変換して統一）
  applyIf(
    (candidate) =>
      !hasCoursework(candidate) && candidate.courseworks !== undefined,
    v1_4_0,
    "1.4.0",
    "1.5.0"
  )

  // 1.9.0 → 1.10.0: 総合（overall）の撤去。移し先が無いので破棄し warning で知らせる
  applyIf(hasOverallResidue, v1_9_0, "1.9.0", "1.10.0")

  // 1.10.0 → 1.11.0: 制約ルールの設定JSON（config）を構造化フィールドへ展開
  applyIf(hasLegacyConstraintConfig, v1_10_0, "1.10.0", "1.11.0")

  // 1.11.0 → 1.12.0: 内包資料をテーブルごとの平坦なセクションへ展開
  applyIf(
    (candidate) =>
      isLegacyCollectedCourseworkData(candidate.legacyCourseworkArchive),
    v1_11_0,
    "1.11.0",
    "1.12.0"
  )

  // 1.12.0 → 1.13.0: 成績本体もテーブルごとの平坦なセクションへ展開
  applyIf(() => true, v1_12_0, "1.12.0", "1.13.0")

  // 1.13.0 → 1.14.0: 境界セットを畳み、境界を評価項目へ直付け
  if (isGradeArchiveV1_13_0(current)) {
    const result = v1_13_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.13.0", to: "1.14.0" })
  }

  // 1.14.0 → 1.15.0: 出力設定の JSON を列へ割る
  if (isGradeArchiveV1_14_0(current)) {
    const result = v1_14_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.14.0", to: "1.15.0" })
  }

  // ここまでで必ず現行の形になっている。なっていなければ変換の取りこぼしなので
  // 黙って先へ流さず落とす（旧い形のまま importer へ渡すと実行時に崩れる）
  const normalized: AnyGradeArchiveData = current
  if (isGradeArchiveUpTo1_12_0(normalized)) {
    throw new Error(
      "grade アーカイブを現行バージョンへ変換できませんでした（射影形式のまま残っています）"
    )
  }
  if (isGradeArchiveV1_13_0(normalized)) {
    throw new Error(
      "grade アーカイブを現行バージョンへ変換できませんでした（境界セットが残っています）"
    )
  }
  if (isGradeArchiveV1_14_0(normalized)) {
    throw new Error(
      "grade アーカイブを現行バージョンへ変換できませんでした（出力設定の JSON が残っています）"
    )
  }

  return {
    data: {
      ...normalized,
      manifest: { ...normalized.manifest, version: GRADE_CURRENT_VERSION },
    },
    originalVersion,
    finalVersion: GRADE_CURRENT_VERSION,
    appliedTransformations,
    warnings,
  }
}
