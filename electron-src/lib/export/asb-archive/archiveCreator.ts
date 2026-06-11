/**
 * ASBアーカイブ (.asb) ZIP作成
 */

import { ZipArchive } from "archiver"
import { app } from "electron"
import * as fs from "fs"
import * as path from "path"

import type { AsbArchiveManifest } from "../../../../src/types/asbArchive.types"
import { ASB_CURRENT_VERSION } from "../../../../src/types/asbArchive.types"
import { getDataDirectory } from "../../dataManager"
import type { CollectedAsbData } from "./dataCollector"

function getAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

function createManifest(collected: CollectedAsbData): AsbArchiveManifest {
  return {
    version: ASB_CURRENT_VERSION,
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    definitionName: collected.definition.name,
    paperSize: collected.definition.settings.paperSize,
    orientation: collected.definition.settings.orientation,
    counts: collected.counts,
  }
}

/**
 * ASBアーカイブを作成
 */
export async function createAsbArchive(
  collected: CollectedAsbData,
  outputPath: string
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const output = fs.createWriteStream(outputPath)
      const archive = new ZipArchive({ zlib: { level: 9 } })
      const missingFiles: string[] = []

      output.on("close", () => {
        resolve({ success: true, outputPath })
      })

      archive.on("error", (err) => {
        console.error("ASB archive error:", err)
        resolve({
          success: false,
          error: `アーカイブ作成エラー: ${err.message}`,
        })
      })

      archive.on("warning", (err) => {
        if (err.code === "ENOENT") {
          console.warn("ASB archive warning:", err)
        } else {
          throw err
        }
      })

      archive.pipe(output)

      // manifest.json
      const manifest = createManifest(collected)
      archive.append(JSON.stringify(manifest, null, 2), {
        name: "manifest.json",
      })

      // definition.json
      archive.append(JSON.stringify(collected.definition, null, 2), {
        name: "definition.json",
      })

      // images/
      const dataDir = getDataDirectory()
      for (const relativePath of collected.imagePaths) {
        const absolutePath = path.join(dataDir, relativePath)
        if (fs.existsSync(absolutePath)) {
          archive.file(absolutePath, {
            name: `images/${path.basename(relativePath)}`,
          })
        } else {
          console.warn(`ASB image not found: ${absolutePath}`)
          missingFiles.push(path.basename(relativePath))
        }
      }

      archive.finalize()
    } catch (error) {
      console.error("Error creating ASB archive:", error)
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
export function generateAsbExportFileName(definitionName: string): string {
  const sanitizedName = definitionName.replace(/[<>:"/\\|?*]/g, "_")
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-")
  return `${sanitizedName}-${timestamp}.asb`
}
