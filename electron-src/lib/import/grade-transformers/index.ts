/**
 * grade-archive バージョン変換器
 *
 * 旧バージョンの外部成績データを現行（1.6.0）の courseworkArchive 形式へ正規化する。
 *
 * 【検出は manifest.version ではなくデータ形状ベース】
 * grade はバージョン履歴が入り組んでおり（1.3.0 の manual / 1.4.0 の名前ベース /
 * 1.5.0 以降の UUIDベース）、旧アーカイブの version 表記が不正確な場合がある。
 * そこで「どのフィールドを持っているか」で適用する変換器を決める:
 *   - manual 型 DataSource あり        → 1.3.0 → 1.4.0（manual を名前ベース資料へ。
 *                                        点数の有無に関わらず変換し "manual" 型を残さない）
 *   - courseworks（名前ベース配列）あり → 1.4.0 → 1.5.0（courseworkArchive へ）
 *   - courseworkArchive あり           → 既に現行形式（1.5.0/1.6.0 とも同形。変換不要）
 *   - 境界セット/上書きに targetType あり → 1.9.0 → 1.10.0（総合エントリを破棄）
 * 1.6.0 は GradeDataSource.maxScore 列の廃止のみで、外部成績の構造は 1.5.0 と同形のため
 * 専用の transformer は持たない（ArchiveDataSource.maxScore は optional で旧読込互換）。
 */

import type { CollectedCourseworkData } from "../../../../src/types/courseworkArchive.types"
import type {
  GradeArchiveData,
  GradeArchiveVersion,
  GradeChainTransformResult,
} from "../../../../src/types/gradeArchive.types"
import { GRADE_CURRENT_VERSION } from "../../../../src/types/gradeArchive.types"
import { isLegacyCollectedCourseworkData } from "../coursework-transformers/legacyShape"
import { V1_3_0_to_V1_4_0_Transformer } from "./V1_3_0_to_V1_4_0"
import { V1_4_0_to_V1_5_0_Transformer } from "./V1_4_0_to_V1_5_0"
import { V1_9_0_to_V1_10_0_Transformer } from "./V1_9_0_to_V1_10_0"
import { V1_10_0_to_V1_11_0_Transformer } from "./V1_10_0_to_V1_11_0"
import { V1_11_0_to_V1_12_0_Transformer } from "./V1_11_0_to_V1_12_0"

const EMPTY_COURSEWORK_ARCHIVE: CollectedCourseworkData = {
  courseworks: [],
  courseworkClassrooms: [],
  courseworkTags: [],
  courseworkStudents: [],
  courseworkItems: [],
  courseworkLetterScales: [],
  courseworkScores: [],
  studentsData: [],
  classesData: [],
  membershipsData: [],
  tagsData: [],
  counts: { courseworks: 0, items: 0, scores: 0, students: 0, classrooms: 0 },
}

const v1_3_0 = new V1_3_0_to_V1_4_0_Transformer()
const v1_4_0 = new V1_4_0_to_V1_5_0_Transformer()
const v1_9_0 = new V1_9_0_to_V1_10_0_Transformer()
const v1_10_0 = new V1_10_0_to_V1_11_0_Transformer()
const v1_11_0 = new V1_11_0_to_V1_12_0_Transformer()

/**
 * 総合（overall）の名残を持つか。境界セット・手動上書きのどちらかに targetType があるか、
 * 対象評価項目名を持たないエントリがあれば 1.9.0 以前の形。
 */
function hasOverallResidue(data: GradeArchiveData): boolean {
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
function hasLegacyConstraintConfig(data: GradeArchiveData): boolean {
  return (data.gradeData.gradeConstraints ?? []).some(
    (gradeConstraint) => gradeConstraint.config !== undefined
  )
}

/** manual 型 DataSource を持つか（点数未入力でも true） */
function hasManualDataSource(data: GradeArchiveData): boolean {
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
function detectOriginalVersion(data: GradeArchiveData): GradeArchiveVersion {
  if (data.courseworks) return "1.4.0"
  if (hasManualDataSource(data) || data.manualScoresData) return "1.3.0"
  if (hasOverallResidue(data)) return "1.9.0"
  if (hasLegacyConstraintConfig(data)) return "1.10.0"
  // 内包資料が入れ子形式なら 1.5.0〜1.11.0 のいずれか。この形だけでは区別できないので
  // 上限の 1.11.0 と報告する（既存の粒度と同じ）
  if (isLegacyCollectedCourseworkData(data.legacyCourseworkArchive)) {
    return "1.11.0"
  }
  return GRADE_CURRENT_VERSION
}

/**
 * grade アーカイブを現行バージョンへ正規化する。
 * 完了後は data.courseworkArchive が必ず存在し、importer は単一経路で処理できる。
 */
export function transformGradeToLatest(
  data: GradeArchiveData
): GradeChainTransformResult {
  let current = data
  const warnings: string[] = []
  const originalVersion = detectOriginalVersion(data)
  const appliedTransformations: GradeChainTransformResult["appliedTransformations"] =
    []

  const hasCoursework = (candidate: GradeArchiveData) =>
    Boolean(candidate.courseworkArchive || candidate.legacyCourseworkArchive)

  // 1.3.0 → 1.4.0: manual 型の外部成績を名前ベース資料へ
  //   点数の有無に関わらず、manual 型 DataSource が残らないよう変換する。
  if (!hasCoursework(current) && hasManualDataSource(current)) {
    const result = v1_3_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.3.0", to: "1.4.0" })
  }

  // 1.4.0 → 1.5.0: 名前ベース資料を入れ子形式の内包資料へ（空配列でも変換して統一）
  if (!hasCoursework(current) && current.courseworks !== undefined) {
    const result = v1_4_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.4.0", to: "1.5.0" })
  }

  // 1.9.0 → 1.10.0: 総合（overall）の撤去。移し先が無いので破棄し warning で知らせる
  if (hasOverallResidue(current)) {
    const result = v1_9_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.9.0", to: "1.10.0" })
  }

  // 1.10.0 → 1.11.0: 制約ルールの設定JSON（config）を構造化フィールドへ展開
  if (hasLegacyConstraintConfig(current)) {
    const result = v1_10_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.10.0", to: "1.11.0" })
  }

  // 1.11.0 → 1.12.0: 内包資料をテーブルごとの平坦なセクションへ展開
  if (isLegacyCollectedCourseworkData(current.legacyCourseworkArchive)) {
    const result = v1_11_0.transform(current)
    current = result.data
    warnings.push(...result.warnings)
    appliedTransformations.push({ from: "1.11.0", to: "1.12.0" })
  }

  // 外部成績を持たない旧アーカイブは空の courseworkArchive を補う
  if (!current.courseworkArchive) {
    current = { ...current, courseworkArchive: EMPTY_COURSEWORK_ARCHIVE }
  }

  // マニフェストを現行バージョンへ
  current = {
    ...current,
    manifest: { ...current.manifest, version: GRADE_CURRENT_VERSION },
  }

  return {
    data: current,
    originalVersion,
    finalVersion: GRADE_CURRENT_VERSION,
    appliedTransformations,
    warnings,
  }
}
