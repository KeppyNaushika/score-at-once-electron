/**
 * 生徒アーカイブ展開モジュール
 *
 * .studentsファイル（ZIP）を展開し、データを読み込む
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type {
  ArchiveClassesData,
  ArchiveStudentsData,
} from "../../../../types/examArchive.types"
import type { StudentArchiveManifest } from "../../../../types/studentArchive.types"

/**
 * 展開された生徒アーカイブデータ
 */
export interface ExtractedStudentArchiveData {
  manifest: StudentArchiveManifest
  studentsData: ArchiveStudentsData
  classesData: ArchiveClassesData
  tempDir: string
}

/**
 * アーカイブを展開してデータを読み込む
 */
export async function extractStudentArchive(archivePath: string): Promise<{
  success: boolean
  data?: ExtractedStudentArchiveData
  error?: string
}> {
  const tempDir = path.join(
    os.tmpdir(),
    `student-archive-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )

  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "アーカイブファイルが見つかりません" }
    }

    const zip = new AdmZip(archivePath)
    zip.extractAllTo(tempDir, true)

    // manifest.json を読み込み
    const manifestPath = path.join(tempDir, "manifest.json")
    if (!fs.existsSync(manifestPath)) {
      return { success: false, error: "manifest.json が見つかりません" }
    }

    const manifest: StudentArchiveManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    )

    // archiveType を検証
    if (manifest.archiveType !== "students") {
      return {
        success: false,
        error: `このファイルは生徒データアーカイブではありません（archiveType: ${manifest.archiveType ?? "undefined"}）`,
      }
    }

    // students.json を読み込み
    const studentsPath = path.join(tempDir, "students.json")
    if (!fs.existsSync(studentsPath)) {
      return { success: false, error: "students.json が見つかりません" }
    }
    const studentsData: ArchiveStudentsData = JSON.parse(
      fs.readFileSync(studentsPath, "utf-8")
    )

    // classes.json を読み込み
    const classesPath = path.join(tempDir, "classes.json")
    if (!fs.existsSync(classesPath)) {
      return { success: false, error: "classes.json が見つかりません" }
    }
    const classesData: ArchiveClassesData = JSON.parse(
      fs.readFileSync(classesPath, "utf-8")
    )

    return {
      success: true,
      data: {
        manifest,
        studentsData,
        classesData,
        tempDir,
      },
    }
  } catch (error) {
    // エラー時にtempDirをクリーンアップ
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true })
      }
    } catch {
      // ignore cleanup error
    }

    console.error("Error extracting student archive:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "アーカイブの展開に失敗しました",
    }
  }
}

/**
 * 一時ディレクトリをクリーンアップ
 */
export function cleanupStudentTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.warn("Failed to cleanup temp dir:", error)
  }
}
