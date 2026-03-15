/**
 * 生徒アーカイブ作成
 *
 * 収集した生徒・学級データをZIPアーカイブにパッケージング
 */

import archiver from "archiver"
import { app } from "electron"
import * as fs from "fs"
import * as path from "path"

import type { StudentArchiveManifest } from "../../../../types/studentArchive.types"
import type { CollectedStudentArchiveData } from "./dataCollector"

/**
 * アプリバージョンを取得
 */
function getAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

/**
 * マニフェストを作成
 */
function createManifest(
  counts: CollectedStudentArchiveData["counts"]
): StudentArchiveManifest {
  return {
    archiveType: "students",
    version: "1.0.0",
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    counts,
  }
}

/**
 * ZIPアーカイブを作成
 */
export async function createStudentArchive(
  collectedData: CollectedStudentArchiveData,
  outputPath: string
): Promise<{
  success: boolean
  outputPath?: string
  manifest?: StudentArchiveManifest
  error?: string
}> {
  return new Promise((resolve) => {
    try {
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const output = fs.createWriteStream(outputPath)
      const archive = archiver("zip", {
        zlib: { level: 9 },
      })

      const manifest = createManifest(collectedData.counts)

      output.on("close", () => {
        resolve({
          success: true,
          outputPath,
          manifest,
        })
      })

      archive.on("error", (err) => {
        console.error("Student archive error:", err)
        resolve({
          success: false,
          error: `アーカイブ作成エラー: ${err.message}`,
        })
      })

      archive.pipe(output)

      // manifest.json
      archive.append(JSON.stringify(manifest, null, 2), {
        name: "manifest.json",
      })

      // students.json
      archive.append(JSON.stringify(collectedData.studentsData, null, 2), {
        name: "students.json",
      })

      // classes.json
      archive.append(JSON.stringify(collectedData.classesData, null, 2), {
        name: "classes.json",
      })

      archive.finalize()
    } catch (error) {
      console.error("Error creating student archive:", error)
      resolve({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "アーカイブ作成に失敗しました",
      })
    }
  })
}

/**
 * デフォルトのエクスポートファイル名を生成
 */
export function generateStudentExportFileName(): string {
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-")

  return `生徒データ-${timestamp}.students`
}
