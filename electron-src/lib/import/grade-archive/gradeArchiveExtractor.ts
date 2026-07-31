/**
 * 成績算出アーカイブ (.grade) 展開・解析
 *
 * v1.13.0 の grade-exam.json はテーブルごとの平坦なセクション。
 * v1.12.0 以前は射影形式（gradeData / boundariesData に分かれていた）で、
 * 形の知識は変換器側（grade-transformers/legacyShape）が持つ。ここでは
 * どちらの形で読んだかだけを見分け、変換器チェーンへ渡す。
 */

import AdmZip from "adm-zip"

import type { CollectedCourseworkData } from "../../../../src/types/courseworkArchive.types"
import type { GradeArchiveManifest } from "../../../../src/types/gradeArchive.types"
import {
  isCurrentCollectedCourseworkData,
  isLegacyCollectedCourseworkData,
  type LegacyCollectedCourseworkData,
} from "../coursework-transformers/legacyShape"
import type {
  LegacyArchiveBoundariesData,
  LegacyArchiveCoursework,
  LegacyArchiveGradeData,
  LegacyArchiveManualScoresData,
} from "../grade-transformers/legacyShape"
import type { AnyGradeArchiveData } from "../grade-transformers/types"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

// archiver で作った ZIP を展開するために unzipper を使用
// 試験に unzipper がない場合は adm-zip を使用
async function extractZip(
  archivePath: string
): Promise<Record<string, string>> {
  const zip = new AdmZip(archivePath)
  const entries = zip.getEntries()
  const files: Record<string, string> = {}

  for (const entry of entries) {
    if (!entry.isDirectory) {
      files[entry.entryName] = entry.getData().toString("utf-8")
    }
  }
  return files
}

/** v1.13.0 の平坦なセクション形式か（成績本体のセクションが揃っているか） */
function isFlatGradeSections(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false
  const sections = value as Record<string, unknown>
  const REQUIRED = [
    "grades",
    "gradeClassrooms",
    "gradeStudents",
    "gradeItems",
    "gradeDataSources",
    "gradeBoundarySets",
    "gradeBoundaries",
    "gradeOverrides",
    "gradeFrozenScores",
    "gradeItemExclusions",
    "gradeConstraints",
  ]
  return REQUIRED.every((key) => Array.isArray(sections[key]))
}

/** 検証済みの配列として読む。壊れていれば空配列（呼び出し側で落ちないように） */
function readArray(sections: Record<string, unknown>, key: string): unknown[] {
  const value = sections[key]
  return Array.isArray(value) ? value : []
}

/** 成績算出アーカイブ（.grade）を展開し、マニフェストと各セクションを解析する */
export async function extractGradeArchive(
  archivePath: string
): Promise<{ success: boolean; data?: AnyGradeArchiveData; error?: string }> {
  try {
    const files = await extractZip(archivePath)

    const manifestJson = files["manifest.json"]
    if (!manifestJson) {
      return { success: false, error: "manifest.jsonが見つかりません" }
    }
    const manifest: GradeArchiveManifest = JSON.parse(manifestJson)

    // 学級リネーム前の旧キー（classId/classes/className/classCode）は読取り時に現行キー（classroom*）へ正規化
    const gradeJson = normalizeLegacyClassroomKeys(
      JSON.parse(files["grade-exam.json"] ?? "{}")
    )

    // 試験外成績資料の埋め込み。
    //   v1.12.0+: courseworks.json は coursework-archive 形式（テーブルごとの平坦なセクション）。
    //   v1.5.0〜1.11.0: 同じくオブジェクトだが入れ子・射影形式。変換器が展開する。
    //   v1.4.0 : courseworks.json は名前ベースの配列。
    let courseworks: LegacyArchiveCoursework[] | undefined
    let courseworkArchive: CollectedCourseworkData | undefined
    let legacyCourseworkArchive: LegacyCollectedCourseworkData | undefined
    if (files["courseworks.json"]) {
      const parsed = normalizeLegacyClassroomKeys(
        JSON.parse(files["courseworks.json"])
      )
      // 現行の形は「全セクションが揃っていること」を実際に確かめてから名乗らせる。
      // 中身で新旧を見分けようとすると、資料を1件も参照していない成績（内包資料が
      // 空で書き出される。旧アーカイブの大多数がこれ）を判別できない。
      if (Array.isArray(parsed)) {
        courseworks = parsed
      } else if (isCurrentCollectedCourseworkData(parsed)) {
        courseworkArchive = parsed
      } else if (isLegacyCollectedCourseworkData(parsed)) {
        legacyCourseworkArchive = parsed
      }
    }

    // v1.13.0: 成績本体もテーブルごとの平坦なセクション
    if (isFlatGradeSections(gradeJson)) {
      const sections = gradeJson as Record<string, unknown>
      return {
        success: true,
        data: {
          manifest,
          grades: readArray(sections, "grades"),
          gradeClassrooms: readArray(sections, "gradeClassrooms"),
          gradeStudents: readArray(sections, "gradeStudents"),
          gradeItems: readArray(sections, "gradeItems"),
          gradeDataSources: readArray(sections, "gradeDataSources"),
          gradeDataSourceEstimationSources: readArray(
            sections,
            "gradeDataSourceEstimationSources"
          ),
          gradeBoundarySets: readArray(sections, "gradeBoundarySets"),
          gradeBoundaries: readArray(sections, "gradeBoundaries"),
          gradeOverrides: readArray(sections, "gradeOverrides"),
          gradeFrozenScores: readArray(sections, "gradeFrozenScores"),
          gradeItemExclusions: readArray(sections, "gradeItemExclusions"),
          gradeConstraints: readArray(sections, "gradeConstraints"),
          gradeConstraintViewpoints: readArray(
            sections,
            "gradeConstraintViewpoints"
          ),
          gradeConstraintLabelValues: readArray(
            sections,
            "gradeConstraintLabelValues"
          ),
          gradeConstraintExclusionLabels: readArray(
            sections,
            "gradeConstraintExclusionLabels"
          ),
          gradeExportSettings: readArray(sections, "gradeExportSettings"),
          studentsData: readArray(sections, "studentsData"),
          classesData: readArray(sections, "classesData"),
          membershipsData: readArray(sections, "membershipsData"),
          examRefs: readArray(sections, "examRefs"),
          subtotalRefs: readArray(sections, "subtotalRefs"),
          cropRegionRefs: readArray(sections, "cropRegionRefs"),
          courseworkArchive: courseworkArchive ?? EMPTY_COURSEWORK_ARCHIVE,
        } as AnyGradeArchiveData,
      }
    }

    // v1.12.0 以前（射影形式）。境界は別ファイルに分かれていた
    const gradeData = gradeJson as LegacyArchiveGradeData
    const boundariesData: LegacyArchiveBoundariesData = JSON.parse(
      files["boundaries.json"] ?? '{"boundarySets":[]}'
    )
    // 旧 v1.3.0 以前: manual-scores.json があれば後方互換用に読む
    const manualScoresData: LegacyArchiveManualScoresData | undefined = files[
      "manual-scores.json"
    ]
      ? JSON.parse(files["manual-scores.json"])
      : undefined

    return {
      success: true,
      data: {
        manifest,
        gradeData,
        boundariesData,
        courseworks,
        courseworkArchive,
        legacyCourseworkArchive,
        manualScoresData,
      },
    }
  } catch (error) {
    console.error("Error extracting grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/** 内包資料が無い（1件も参照していない）成績の既定値 */
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
