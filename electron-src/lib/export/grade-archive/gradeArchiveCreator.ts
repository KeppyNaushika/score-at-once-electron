/**
 * 成績算出アーカイブ (.grade) 作成
 */

import { ZipArchive } from "archiver"
import { app } from "electron"
import * as fs from "fs"

import type { GradeArchiveManifest } from "../../../../src/types/gradeArchive.types"
import { collectGradeArchiveData } from "./gradeArchiveDataCollector"

function getAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

export async function createGradeArchive(
  gradeId: string,
  outputPath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const data = await collectGradeArchiveData(gradeId)

    const manifest: GradeArchiveManifest = {
      version: "1.1.0",
      appVersion: getAppVersion(),
      exportedAt: new Date().toISOString(),
      gradeId,
      gradeName: data.gradeData.grade.name,
      counts: data.counts,
    }

    const output = fs.createWriteStream(outputPath)
    const archive = new ZipArchive({ zlib: { level: 9 } })

    return new Promise((resolve, reject) => {
      output.on("close", () => {
        resolve({ success: true })
      })

      archive.on("error", (err) => {
        reject(err)
      })

      archive.pipe(output)

      archive.append(JSON.stringify(manifest, null, 2), {
        name: "manifest.json",
      })
      archive.append(JSON.stringify(data.gradeData, null, 2), {
        name: "grade-exam.json",
      })
      archive.append(JSON.stringify(data.manualScoresData, null, 2), {
        name: "manual-scores.json",
      })
      archive.append(JSON.stringify(data.boundariesData, null, 2), {
        name: "boundaries.json",
      })

      archive.finalize()
    })
  } catch (error) {
    console.error("Error creating grade archive:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
