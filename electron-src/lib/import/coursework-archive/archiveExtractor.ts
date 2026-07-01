/**
 * 試験外成績資料アーカイブ (.coursework) の展開
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type {
  ArchiveCourseworkRef,
  ArchiveCwClass,
  ArchiveCwMembership,
  ArchiveCwStudent,
  ArchiveCwTag,
  CourseworkArchiveData,
  CourseworkArchiveManifest,
} from "../../../../src/types/courseworkArchive.types"
import { normalizeLegacyClassroomKeys } from "../shared/legacyClassroomKeys"

export interface ExtractedCourseworkArchive {
  manifest: CourseworkArchiveManifest
  data: CourseworkArchiveData
  tempDir: string
}

function readJsonFile<T>(dir: string, name: string): T | null {
  const p = path.join(dir, name)
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, "utf-8")) as T
}

/**
 * .coursework アーカイブを一時ディレクトリへ展開し、各 JSON を読み込む。
 * 呼び出し側は data.tempDir を cleanupCourseworkTempDir で必ず後始末すること。
 */
export async function extractCourseworkArchive(archivePath: string): Promise<{
  success: boolean
  data?: ExtractedCourseworkArchive
  error?: string
}> {
  const tempDir = path.join(
    os.tmpdir(),
    `coursework-archive-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )

  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "アーカイブファイルが見つかりません" }
    }

    const zip = new AdmZip(archivePath)
    zip.extractAllTo(tempDir, true)

    const manifest = readJsonFile<CourseworkArchiveManifest>(
      tempDir,
      "manifest.json"
    )
    if (!manifest) {
      cleanupCourseworkTempDir(tempDir)
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }

    // 学級リネーム前の旧キー（classId/classes）は読取り時に現行キーへ正規化
    const courseworks = normalizeLegacyClassroomKeys(
      readJsonFile<ArchiveCourseworkRef[]>(tempDir, "courseworks.json") ?? []
    )
    const studentsData =
      readJsonFile<ArchiveCwStudent[]>(tempDir, "students.json") ?? []
    const classesData = normalizeLegacyClassroomKeys(
      readJsonFile<ArchiveCwClass[]>(tempDir, "classes.json") ?? []
    )
    const membershipsData = normalizeLegacyClassroomKeys(
      readJsonFile<ArchiveCwMembership[]>(tempDir, "memberships.json") ?? []
    )
    const tagsData = readJsonFile<ArchiveCwTag[]>(tempDir, "tags.json") ?? []

    return {
      success: true,
      data: {
        manifest,
        data: {
          manifest,
          courseworks,
          studentsData,
          classesData,
          membershipsData,
          tagsData,
        },
        tempDir,
      },
    }
  } catch (error) {
    cleanupCourseworkTempDir(tempDir)
    console.error("Error extracting coursework archive:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "アーカイブの展開に失敗しました",
    }
  }
}

/** 一時ディレクトリを削除 */
export function cleanupCourseworkTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error("Error cleaning up temp directory:", error)
  }
}

/** マニフェストのみ読み込む（プレビュー用、全展開なし） */
export async function readCourseworkManifestOnly(archivePath: string): Promise<{
  success: boolean
  manifest?: CourseworkArchiveManifest
  error?: string
}> {
  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "アーカイブファイルが見つかりません" }
    }
    const zip = new AdmZip(archivePath)
    const entry = zip.getEntry("manifest.json")
    if (!entry) {
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }
    const manifest: CourseworkArchiveManifest = JSON.parse(
      zip.readAsText(entry)
    )
    return { success: true, manifest }
  } catch (error) {
    console.error("Error reading coursework manifest:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "マニフェストの読み込みに失敗しました",
    }
  }
}
