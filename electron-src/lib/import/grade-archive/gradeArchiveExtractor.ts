/**
 * 成績算出アーカイブ (.grade) 展開・解析
 */

import type { CollectedCourseworkData } from "../../../../src/types/courseworkArchive.types"
import type {
  ArchiveBoundariesData,
  ArchiveCoursework,
  ArchiveGradeData,
  ArchiveManualScoresData,
  GradeArchiveData,
  GradeArchiveManifest,
} from "../../../../src/types/gradeArchive.types"
import {
  isCurrentCollectedCourseworkData,
  isLegacyCollectedCourseworkData,
  type LegacyCollectedCourseworkData,
} from "../coursework-transformers/legacyShape"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

// archiver で作った ZIP を展開するために unzipper を使用
// 試験に unzipper がない場合は adm-zip を使用
async function extractZip(
  archivePath: string
): Promise<Record<string, string>> {
  // Node.js built-in で ZIP を解凍
  const AdmZip = (await import("adm-zip")).default
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

/** 成績算出アーカイブ（.grade）を展開し、マニフェスト・成績データ・手動スコア・境界値を解析する */
export async function extractGradeArchive(
  archivePath: string
): Promise<{ success: boolean; data?: GradeArchiveData; error?: string }> {
  try {
    const files = await extractZip(archivePath)

    const manifestJson = files["manifest.json"]
    if (!manifestJson) {
      return { success: false, error: "manifest.jsonが見つかりません" }
    }

    const manifest: GradeArchiveManifest = JSON.parse(manifestJson)
    // 学級リネーム前の旧キー（classId/classes/className/classCode）は読取り時に現行キー（classroom*）へ正規化
    const gradeData: ArchiveGradeData = normalizeLegacyClassroomKeys(
      JSON.parse(files["grade-exam.json"] ?? "{}")
    )
    const boundariesData: ArchiveBoundariesData = JSON.parse(
      files["boundaries.json"] ?? '{"boundarySets":[]}'
    )
    // 試験外成績資料の埋め込み。
    //   v1.12.0+: courseworks.json は coursework-archive 形式（テーブルごとの平坦なセクション）。
    //   v1.5.0〜1.11.0: 同じくオブジェクトだが入れ子・射影形式。変換器が展開する。
    //   v1.4.0 : courseworks.json は名前ベースの ArchiveCoursework[] 配列。
    let courseworks: ArchiveCoursework[] | undefined
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
    // 旧 v1.3.0 以前: manual-scores.json があれば後方互換用に読む
    const manualScoresData: ArchiveManualScoresData | undefined = files[
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
