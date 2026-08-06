/**
 * ASBアーカイブ展開モジュール
 */

import AdmZip from "adm-zip"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"

import type { AnswerSheetDefinition } from "../../../../src/types/answerSheetDefinition.types"
import type {
  ArchiveAsbTag,
  AsbArchiveManifest,
  AsbDefinitionTagRef,
} from "../../../../src/types/asbArchive.types"

interface ExtractedAsbData {
  manifest: AsbArchiveManifest
  definition: AnswerSheetDefinition
  tempDir: string
  imagePaths: string[]
  /** タグ本体（v1.2.0+）。旧アーカイブや未同梱時は空配列。 */
  tagsData: ArchiveAsbTag[]
  /** 定義へのタグ参照（v1.2.0+）。旧アーカイブや未同梱時は空配列。 */
  asbDefinitionTags: AsbDefinitionTagRef[]
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

    // tags.json（v1.2.0+。旧アーカイブには存在しない）
    let tagsData: ArchiveAsbTag[] = []
    let asbDefinitionTags: AsbDefinitionTagRef[] = []
    const tagsPath = path.join(tempDir, "tags.json")
    if (fs.existsSync(tagsPath)) {
      const tagsFile: {
        tagsData?: ArchiveAsbTag[]
        asbDefinitionTags?: AsbDefinitionTagRef[]
      } = JSON.parse(fs.readFileSync(tagsPath, "utf-8"))
      tagsData = tagsFile.tagsData ?? []
      asbDefinitionTags = tagsFile.asbDefinitionTags ?? []
    }

    return {
      success: true,
      data: {
        manifest,
        definition,
        tempDir,
        imagePaths,
        tagsData,
        asbDefinitionTags,
      },
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
