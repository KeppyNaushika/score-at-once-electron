/**
 * 成績算出アーカイブ (.grade) 展開・解析
 */

import type {
  ArchiveBoundariesData,
  ArchiveCoursework,
  ArchiveGradeData,
  ArchiveManualScoresData,
  GradeArchiveData,
  GradeArchiveManifest,
} from "../../../../src/types/gradeArchive.types"

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
    const gradeData: ArchiveGradeData = JSON.parse(
      files["grade-exam.json"] ?? "{}"
    )
    const boundariesData: ArchiveBoundariesData = JSON.parse(
      files["boundaries.json"] ?? '{"boundarySets":[]}'
    )
    // v1.4.0+: 試験外成績資料の埋め込み
    const courseworks: ArchiveCoursework[] | undefined = files[
      "courseworks.json"
    ]
      ? JSON.parse(files["courseworks.json"])
      : undefined
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
