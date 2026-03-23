/**
 * 試験アーカイブ作成
 *
 * 収集したデータと画像ファイルをZIPアーカイブにパッケージング
 */

import archiver from "archiver"
import { app } from "electron"
import * as fs from "fs"
import * as path from "path"

import type {
  ArchiveManifest,
  ExportMode,
} from "../../../../src/types/examArchive.types"
import { getDataDirectory } from "../../dataManager"
import { CURRENT_VERSION } from "../../import/transformers/types"
import type { CollectedData } from "./dataCollector"

/**
 * アプリバージョンを取得
 */
function getAppVersion(): string {
  try {
    return app.getVersion()
  } catch {
    return "0.0.0"
  }
}

/**
 * アーカイブ作成オプション
 */
interface CreateArchiveOptions {
  /** 収集されたデータ */
  collectedData: CollectedData
  /** 試験名 */
  examName: string
  /** 試験ID */
  examId: string
  /** 出力先パス */
  outputPath: string
  /** エクスポートしたユーザー名 */
  exportedBy?: string
  /** エクスポートモード */
  exportMode?: ExportMode
}

/**
 * 現在のスキーマバージョンを取得
 *
 * Prismaマイグレーション名から取得（最新のマイグレーション名）
 */
function getSchemaVersion(): string {
  try {
    const migrationsDir = path.join(app.getAppPath(), "prisma", "migrations")
    if (fs.existsSync(migrationsDir)) {
      const migrations = fs
        .readdirSync(migrationsDir)
        .filter((f) => !f.startsWith(".") && f !== "migration_lock.toml")
        .sort()
      if (migrations.length > 0) {
        return migrations[migrations.length - 1]
      }
    }
  } catch {
    // フォールバック
  }
  return "unknown"
}

/**
 * マニフェストを作成
 */
function createManifest(
  examId: string,
  examName: string,
  counts: CollectedData["counts"],
  exportedBy?: string,
  exportMode?: ExportMode
): ArchiveManifest {
  return {
    version: CURRENT_VERSION,
    schemaVersion: getSchemaVersion(),
    appVersion: getAppVersion(),
    exportedAt: new Date().toISOString(),
    examId,
    examName,
    exportedBy,
    counts,
    ...(exportMode && exportMode !== "full" ? { exportMode } : {}),
  }
}

/**
 * データディレクトリのパスを取得
 *
 * 画像パスはdataディレクトリからの相対パス（例: exams/{examId}/master-answers/image.png）で保存されているため、
 * dataディレクトリのパスを返す
 */
function getDataDir(): string {
  return getDataDirectory()
}

/**
 * ZIPアーカイブを作成
 *
 * @param options - アーカイブ作成オプション
 * @returns 作成されたアーカイブのパス
 */
export async function createArchive(options: CreateArchiveOptions): Promise<{
  success: boolean
  outputPath?: string
  error?: string
  warnings?: string[]
}> {
  const {
    collectedData,
    examName,
    examId,
    outputPath,
    exportedBy,
    exportMode,
  } = options

  return new Promise((resolve) => {
    try {
      // 出力ディレクトリを確認
      const outputDir = path.dirname(outputPath)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // ZIPストリームを作成
      const output = fs.createWriteStream(outputPath)
      const archive = archiver("zip", {
        zlib: { level: 9 }, // 最高圧縮率
      })

      const missingFiles: string[] = []

      output.on("close", () => {
        resolve({
          success: true,
          outputPath,
          ...(missingFiles.length > 0 ? { warnings: missingFiles } : {}),
        })
      })

      archive.on("error", (err) => {
        console.error("Archive error:", err)
        resolve({
          success: false,
          error: `アーカイブ作成エラー: ${err.message}`,
        })
      })

      archive.on("warning", (err) => {
        if (err.code === "ENOENT") {
          console.warn("Archive warning:", err)
        } else {
          throw err
        }
      })

      archive.pipe(output)

      // 1. マニフェストを追加
      const manifest = createManifest(
        examId,
        examName,
        collectedData.counts,
        exportedBy,
        exportMode
      )
      archive.append(JSON.stringify(manifest, null, 2), {
        name: "manifest.json",
      })

      // 2. JSONデータファイルを追加
      archive.append(JSON.stringify(collectedData.examData, null, 2), {
        name: "exam.json",
      })
      archive.append(JSON.stringify(collectedData.studentsData, null, 2), {
        name: "students.json",
      })
      archive.append(JSON.stringify(collectedData.classesData, null, 2), {
        name: "classes.json",
      })
      archive.append(JSON.stringify(collectedData.usersData, null, 2), {
        name: "users.json",
      })
      archive.append(JSON.stringify(collectedData.subtotalsData, null, 2), {
        name: "subtotals.json",
      })
      archive.append(JSON.stringify(collectedData.scoresData, null, 2), {
        name: "scores.json",
      })
      archive.append(JSON.stringify(collectedData.tagsData, null, 2), {
        name: "tags.json",
      })
      archive.append(
        JSON.stringify(collectedData.deletedRecordsData, null, 2),
        { name: "deleted-records.json" }
      )

      // 3. マスター画像を追加
      // 注意: relativePathはdataディレクトリからの相対パス（例: exams/{examId}/master-answers/image.png）
      const dataDir = getDataDir()

      for (const relativePath of collectedData.masterImagePaths) {
        const absolutePath = path.join(dataDir, relativePath)
        if (fs.existsSync(absolutePath)) {
          // master-images/ディレクトリ配下に配置
          const archivePath = `master-images/${path.basename(relativePath)}`
          archive.file(absolutePath, { name: archivePath })
        } else {
          console.warn(`Master image not found: ${absolutePath}`)
          missingFiles.push(`模範解答画像: ${path.basename(relativePath)}`)
        }
      }

      // 4. 答案画像を追加
      for (const relativePath of collectedData.answerSheetPaths) {
        const absolutePath = path.join(dataDir, relativePath)
        if (fs.existsSync(absolutePath)) {
          // answer-sheets/ディレクトリ配下に配置
          const archivePath = `answer-sheets/${path.basename(relativePath)}`
          archive.file(absolutePath, { name: archivePath })
        } else {
          console.warn(`Answer sheet not found: ${absolutePath}`)
          missingFiles.push(`答案画像: ${path.basename(relativePath)}`)
        }
      }

      // アーカイブを完了
      archive.finalize()
    } catch (error) {
      console.error("Error creating archive:", error)
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
 *
 * フォーマット: {examName}-yyyy-MM-dd-hh-mm-ss.score
 */
export function generateExportFileName(
  examName: string,
  exportMode?: ExportMode
): string {
  const sanitizedName = examName.replace(/[<>:"/\\|?*]/g, "_")
  const now = new Date()
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("-")

  const modeSuffix =
    exportMode === "template"
      ? "-template"
      : exportMode === "template_with_subtotals"
        ? "-template-subtotals"
        : ""

  return `${sanitizedName}${modeSuffix}-${timestamp}.score`
}
