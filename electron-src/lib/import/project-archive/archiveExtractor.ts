/**
 * アーカイブ展開モジュール
 *
 * ZIPアーカイブを展開し、データを読み込む
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type {
  ArchiveClassesData,
  ArchiveManifest,
  ArchiveProjectData,
  ArchiveScoresData,
  ArchiveStudentsData,
  ArchiveSubtotalsData,
  ArchiveUsersData,
} from "../../../../types/projectArchive.types"

/**
 * 展開されたアーカイブデータ
 */
export interface ExtractedArchiveData {
  /** マニフェスト */
  manifest: ArchiveManifest
  /** プロジェクトデータ */
  projectData: ArchiveProjectData
  /** 生徒データ */
  studentsData: ArchiveStudentsData
  /** 学級データ */
  classesData: ArchiveClassesData
  /** ユーザーデータ */
  usersData: ArchiveUsersData
  /** 小計データ */
  subtotalsData: ArchiveSubtotalsData
  /** 採点データ */
  scoresData: ArchiveScoresData
  /** 一時展開ディレクトリパス */
  tempDir: string
  /** マスター画像のパス一覧 (展開後のフルパス) */
  masterImagePaths: string[]
  /** 答案画像のパス一覧 (展開後のフルパス) */
  answerSheetPaths: string[]
}

/**
 * アーカイブを展開してデータを読み込む
 *
 * @param archivePath - ZIPアーカイブのパス
 * @returns 展開されたデータ
 */
export async function extractArchive(archivePath: string): Promise<{
  success: boolean
  data?: ExtractedArchiveData
  error?: string
}> {
  // 一時ディレクトリを作成
  const tempDir = path.join(
    os.tmpdir(),
    `project-archive-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )

  try {
    // ファイル存在確認
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "アーカイブファイルが見つかりません" }
    }

    // ZIPを展開
    const zip = new AdmZip(archivePath)
    zip.extractAllTo(tempDir, true)

    // マニフェストを読み込み
    const manifestPath = path.join(tempDir, "manifest.json")
    if (!fs.existsSync(manifestPath)) {
      cleanupTempDir(tempDir)
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }
    const manifest: ArchiveManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    )

    // 各JSONファイルを読み込み
    const projectData = readJsonFile<ArchiveProjectData>(
      tempDir,
      "project.json"
    )
    const studentsData = readJsonFile<ArchiveStudentsData>(
      tempDir,
      "students.json"
    )
    const classesData = readJsonFile<ArchiveClassesData>(
      tempDir,
      "classes.json"
    )
    const usersData = readJsonFile<ArchiveUsersData>(tempDir, "users.json")
    const subtotalsData = readJsonFile<ArchiveSubtotalsData>(
      tempDir,
      "subtotals.json"
    )
    const scoresData = readJsonFile<ArchiveScoresData>(tempDir, "scores.json")

    if (
      !projectData ||
      !studentsData ||
      !classesData ||
      !usersData ||
      !subtotalsData ||
      !scoresData
    ) {
      cleanupTempDir(tempDir)
      return { success: false, error: "必要なJSONファイルが見つかりません" }
    }

    // 画像パスを収集
    const masterImagesDir = path.join(tempDir, "master-images")
    const answerSheetsDir = path.join(tempDir, "answer-sheets")

    const masterImagePaths = collectImagePaths(masterImagesDir)
    const answerSheetPaths = collectImagePaths(answerSheetsDir)

    return {
      success: true,
      data: {
        manifest,
        projectData,
        studentsData,
        classesData,
        usersData,
        subtotalsData,
        scoresData,
        tempDir,
        masterImagePaths,
        answerSheetPaths,
      },
    }
  } catch (error) {
    cleanupTempDir(tempDir)
    console.error("Error extracting archive:", error)
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
 * JSONファイルを読み込む
 */
function readJsonFile<T>(tempDir: string, filename: string): T | null {
  const filePath = path.join(tempDir, filename)
  if (!fs.existsSync(filePath)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T
  } catch {
    return null
  }
}

/**
 * ディレクトリ内の画像ファイルパスを収集
 */
function collectImagePaths(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return []
  }

  const paths: string[] = []
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // サブディレクトリを再帰的に探索
      paths.push(...collectImagePaths(fullPath))
    } else if (isImageFile(entry.name)) {
      paths.push(fullPath)
    }
  }

  return paths
}

/**
 * 画像ファイルかどうかを判定
 */
function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext)
}

/**
 * 一時ディレクトリを削除
 */
export function cleanupTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error("Error cleaning up temp directory:", error)
  }
}

/**
 * マニフェストのみを読み込む（プレビュー用）
 */
export async function readManifestOnly(archivePath: string): Promise<{
  success: boolean
  manifest?: ArchiveManifest
  error?: string
}> {
  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "アーカイブファイルが見つかりません" }
    }

    const zip = new AdmZip(archivePath)
    const manifestEntry = zip.getEntry("manifest.json")

    if (!manifestEntry) {
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }

    const manifestData = zip.readAsText(manifestEntry)
    const manifest: ArchiveManifest = JSON.parse(manifestData)

    return { success: true, manifest }
  } catch (error) {
    console.error("Error reading manifest:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "マニフェストの読み込みに失敗しました",
    }
  }
}
