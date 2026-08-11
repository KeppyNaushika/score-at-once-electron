/**
 * 試験外成績資料アーカイブ (.coursework) 作成
 */

import { ZipArchive } from "archiver"
import { app } from "electron"
import * as fs from "fs"

import {
  COURSEWORK_CURRENT_VERSION,
  type CourseworkArchiveManifest,
} from "../../../../src/types/courseworkArchive.types"
import { recordAuditLog } from "../../prisma/auditLog"
import { collectCourseworkArchiveData } from "./dataCollector"

function getAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

/**
 * 指定 coursework を .coursework アーカイブとして outputPath に書き出す。
 */
export async function createCourseworkArchive(
  courseworkId: string,
  courseworkName: string,
  outputPath: string
): Promise<CourseworkArchiveManifest> {
  const data = await collectCourseworkArchiveData([courseworkId])

  const manifest: CourseworkArchiveManifest = {
    version: COURSEWORK_CURRENT_VERSION,
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    counts: data.counts,
  }

  const output = fs.createWriteStream(outputPath)
  const archive = new ZipArchive({ zlib: { level: 9 } })

  return await new Promise((resolve, reject) => {
    output.on("close", () => {
      void recordAuditLog({
        action: "coursework.export",
        entityType: "Coursework",
        entityId: courseworkId,
        scopeId: courseworkId,
        scopeLabel: courseworkName,
        target: courseworkName,
        extra: { outputPath },
      })
      resolve(manifest)
    })

    archive.on("error", (err) => {
      reject(err)
    })

    archive.pipe(output)

    archive.append(JSON.stringify(manifest, null, 2), {
      name: "manifest.json",
    })
    // テーブルごとに1ファイル（v1.1.0）。旧 v1.0.0 は courseworks.json に
    // 入れ子ツリーを1本だけ書いていた
    archive.append(JSON.stringify(data.courseworks, null, 2), {
      name: "courseworks.json",
    })
    archive.append(JSON.stringify(data.courseworkClassrooms, null, 2), {
      name: "coursework-classrooms.json",
    })
    archive.append(JSON.stringify(data.courseworkTags, null, 2), {
      name: "coursework-tags.json",
    })
    archive.append(JSON.stringify(data.courseworkStudents, null, 2), {
      name: "coursework-students.json",
    })
    archive.append(JSON.stringify(data.courseworkItems, null, 2), {
      name: "coursework-items.json",
    })
    archive.append(JSON.stringify(data.courseworkLetterScales, null, 2), {
      name: "coursework-letter-scales.json",
    })
    archive.append(JSON.stringify(data.courseworkScores, null, 2), {
      name: "coursework-scores.json",
    })
    archive.append(JSON.stringify(data.studentsData, null, 2), {
      name: "students.json",
    })
    archive.append(JSON.stringify(data.classesData, null, 2), {
      name: "classes.json",
    })
    archive.append(JSON.stringify(data.membershipsData, null, 2), {
      name: "memberships.json",
    })
    archive.append(JSON.stringify(data.tagsData, null, 2), {
      name: "tags.json",
    })

    archive.finalize()
  })
}

/** エクスポートファイル名を生成 (`{資料名}-yyyy-MM-dd-hh-mm-ss.coursework`) */
export function generateCourseworkExportFileName(
  courseworkName: string
): string {
  const sanitized =
    courseworkName.replace(/[\\/:*?"<>|]/g, "_").trim() || "coursework"
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
  return `${sanitized}-${stamp}.coursework`
}
