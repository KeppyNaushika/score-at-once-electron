/**
 * ASBアーカイブ展開モジュール
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
import type { AsbArchiveManifest } from "../../../../src/types/asbArchive.types"

export interface ExtractedAsbData {
  manifest: AsbArchiveManifest
  definition: AnswerSheetDefinition
  tempDir: string
  imagePaths: string[]
}

/**
 * ASBアーカイブを展開してデータを読み込む
 */
export async function extractAsbArchive(archivePath: string): Promise<{
  success: boolean
  data?: ExtractedAsbData
  error?: string
}> {
  const tempDir = path.join(
    os.tmpdir(),
    `asb-archive-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  )

  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "ファイルが見つかりません" }
    }

    const zip = new AdmZip(archivePath)
    zip.extractAllTo(tempDir, true)

    // manifest.json
    const manifestPath = path.join(tempDir, "manifest.json")
    if (!fs.existsSync(manifestPath)) {
      cleanupAsbTempDir(tempDir)
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }
    const manifest: AsbArchiveManifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf-8")
    )

    // definition.json
    const definitionPath = path.join(tempDir, "definition.json")
    if (!fs.existsSync(definitionPath)) {
      cleanupAsbTempDir(tempDir)
      return { success: false, error: "定義ファイルが見つかりません" }
    }
    const definition: AnswerSheetDefinition = JSON.parse(
      fs.readFileSync(definitionPath, "utf-8")
    )

    // images/
    const imagesDir = path.join(tempDir, "images")
    const imagePaths = collectImagePaths(imagesDir)

    return {
      success: true,
      data: { manifest, definition, tempDir, imagePaths },
    }
  } catch (error) {
    cleanupAsbTempDir(tempDir)
    console.error("Error extracting ASB archive:", error)
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
 * マニフェストのみを読み込む（プレビュー用）
 */
export async function readAsbManifestOnly(archivePath: string): Promise<{
  success: boolean
  manifest?: AsbArchiveManifest
  error?: string
}> {
  try {
    if (!fs.existsSync(archivePath)) {
      return { success: false, error: "ファイルが見つかりません" }
    }

    const zip = new AdmZip(archivePath)
    const manifestEntry = zip.getEntry("manifest.json")
    if (!manifestEntry) {
      return { success: false, error: "マニフェストファイルが見つかりません" }
    }

    const manifest: AsbArchiveManifest = JSON.parse(
      zip.readAsText(manifestEntry)
    )
    return { success: true, manifest }
  } catch (error) {
    console.error("Error reading ASB manifest:", error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "マニフェストの読み込みに失敗しました",
    }
  }
}

function collectImagePaths(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const paths: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      paths.push(...collectImagePaths(fullPath))
    } else if (isImageFile(entry.name)) {
      paths.push(fullPath)
    }
  }
  return paths
}

function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"].includes(ext)
}

/** ASBアーカイブ展開時に作成された一時ディレクトリを削除する */
export function cleanupAsbTempDir(tempDir: string): void {
  try {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  } catch (error) {
    console.error("Error cleaning up ASB temp directory:", error)
  }
}
