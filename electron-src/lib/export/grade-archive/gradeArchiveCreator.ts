/**
 * 成績算出アーカイブ (.grade) 作成
 */

import { ZipArchive } from "archiver"
import { app } from "electron"
import * as fs from "fs"

import type { GradeArchiveManifest } from "../../../../src/types/gradeArchive.types"
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
      // v1.4.0: 外部成績(manual型 DataSource)を試験外成績資料(Coursework)へ昇格。
      //   参照中の資料を自己完結で埋め込み、資料/評価項目/DataSource参照に uuid を併記する
      //   （照合の一次キー。インポートは uuid 一致を優先し、名前照合はユーザー判断の二次フォールバック）。
      //   ※ v1.3.0 以前の manual-scores は読み取り後方互換のみ。
      version: "1.4.0",
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
      archive.append(JSON.stringify(data.courseworksData, null, 2), {
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
