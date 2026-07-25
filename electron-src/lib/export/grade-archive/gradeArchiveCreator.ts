/**
 * 成績算出アーカイブ (.grade) 作成
 */

import { ZipArchive } from "archiver"
import { app } from "electron"
import * as fs from "fs"

import type { GradeArchiveManifest } from "../../../../src/types/gradeArchive.types"
import { GRADE_CURRENT_VERSION } from "../../../../src/types/gradeArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
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
      // バージョンは定数から取る。文字列を直書きすると GRADE_CURRENT_VERSION を上げても
      // 書き出す manifest が古いままになる（exam / coursework / asb と同じ扱いに揃える）。
      // バージョン履歴は gradeArchive.types.ts の GradeArchiveVersion コメント参照。
      version: GRADE_CURRENT_VERSION,
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
        // 監査ログ: 成績エクスポート（ベストエフォート）
        void recordAuditLog({
          action: "grade.export",
          entityType: "Grade",
          entityId: gradeId,
          scopeId: gradeId,
          scopeLabel: data.gradeData.grade.name,
          target: data.gradeData.grade.name,
          extra: { outputPath },
        })
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
      archive.append(JSON.stringify(data.courseworkArchive, null, 2), {
        name: "courseworks.json",
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
