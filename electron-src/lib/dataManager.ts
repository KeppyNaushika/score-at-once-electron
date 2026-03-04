import { app } from "electron"
import * as fs from "fs/promises"
import * as path from "path"

// アプリケーションのルートディレクトリ（実行ファイルがある場所）
export const getAppRootPath = (): string => {
  if (app.isPackaged) {
    // パッケージ化されている場合
    const exePath = app.getPath("exe")
    // macOSの場合、.appと同階層にdataフォルダを作成
    if (process.platform === "darwin" && exePath.includes(".app/")) {
      // /path/to/Score at Once.app/Contents/MacOS/score-at-once
      // から /path/to/ を取得
      const appPath = exePath.substring(0, exePath.indexOf(".app/") + 4)
      const rootPath = path.dirname(appPath)
      return rootPath
    }

    // Windows等その他のプラットフォーム
    const rootPath = path.dirname(exePath)

    // Windowsでファイルパスが適切に解決されるかチェック
    try {
      const fs = require("fs")
      const exists = fs.existsSync(rootPath)
      if (!exists) {
        console.error(`Windows root path does not exist: ${rootPath}`)
      }
    } catch (error) {
      console.error(`Error checking Windows root path:`, error)
    }

    return rootPath
  } else {
    // 開発環境の場合
    const rootPath = process.cwd()
    return rootPath
  }
}

// データディレクトリのパス
export const getDataDirectory = (): string => {
  const dataPath = path.join(getAppRootPath(), "data")
  return dataPath
}

// 試験ディレクトリのパス
export const getExamDirectory = (examId: string): string => {
  return path.join(getDataDirectory(), "exams", examId)
}

// 答案保存ディレクトリのパス
export const getAnswerSheetsDirectory = (examId: string): string => {
  return path.join(getExamDirectory(examId), "answer-sheets")
}

// マスター解答保存ディレクトリのパス
export const getMasterAnswersDirectory = (examId: string): string => {
  return path.join(getExamDirectory(examId), "master-answers")
}

// ASB画像保存ディレクトリのパス
export const getAsbImagesDirectory = (definitionId: string): string => {
  return path.join(
    getDataDirectory(),
    "answer-sheet-builder",
    definitionId,
    "images"
  )
}

// 出力ディレクトリのパス
export const getExportsDirectory = (): string => {
  return path.join(getDataDirectory(), "exports")
}

// データディレクトリの初期化
export const initializeDataDirectory = async (): Promise<void> => {
  const dataDir = getDataDirectory()

  try {
    // 親ディレクトリの存在確認と作成
    const parentDir = path.dirname(dataDir)
    await fs.mkdir(parentDir, { recursive: true, mode: 0o755 })

    // データディレクトリの作成
    await fs.mkdir(dataDir, { recursive: true, mode: 0o755 })

    // サブディレクトリの作成
    const examsDir = path.join(dataDir, "exams")
    const exportsDir = getExportsDirectory()

    await fs.mkdir(examsDir, { recursive: true, mode: 0o755 })
    await fs.mkdir(exportsDir, { recursive: true, mode: 0o755 })
  } catch (error) {
    console.error("Failed to initialize data directory:", error)
    console.error("Data directory path:", dataDir)
    console.error("Process platform:", process.platform)
    console.error("App is packaged:", app.isPackaged)

    throw new Error(
      `Data directory initialization failed: ${error instanceof Error ? error.message : error}`
    )
  }
}

// data/projects/ → data/exams/ マイグレーション（v0.6.x リネーム対応）
export const migrateProjectsToExams = async (): Promise<boolean> => {
  const dataDir = getDataDirectory()
  const oldProjectsDir = path.join(dataDir, "projects")
  const newExamsDir = path.join(dataDir, "exams")

  try {
    await fs.access(oldProjectsDir)
  } catch {
    // data/projects/ が存在しない場合はスキップ
    return false
  }

  try {
    // data/exams/ を作成
    await fs.mkdir(newExamsDir, { recursive: true })

    // 各試験ディレクトリをコピー
    const examDirs = await fs.readdir(oldProjectsDir)
    for (const dir of examDirs) {
      const oldPath = path.join(oldProjectsDir, dir)
      const newPath = path.join(newExamsDir, dir)

      // 移行先に既にある場合はスキップ
      try {
        await fs.access(newPath)
        console.log(`Skipping already migrated exam directory: ${dir}`)
        continue
      } catch {
        // 存在しないのでコピー
      }

      await copyDirectory(oldPath, newPath)
    }

    // 旧ディレクトリを削除
    await fs.rm(oldProjectsDir, { recursive: true, force: true })
    console.log(
      `Successfully migrated data/projects/ → data/exams/ (${examDirs.length} directories)`
    )
    return true
  } catch (error) {
    console.error("Failed to migrate projects to exams:", error)
    return false
  }
}

// ApplicationSupportからの移行処理
export const migrateFromApplicationSupport = async (): Promise<boolean> => {
  const oldDataPath = path.join(app.getPath("userData"))
  const newDataPath = getDataDirectory()

  try {
    // 旧データの存在確認
    const oldExamsPath = path.join(oldDataPath, "exams")
    const oldDbPath = path.join(oldDataPath, "database.db")

    let hasMigrated = false

    // 試験フォルダの移行
    try {
      await fs.access(oldExamsPath)

      const newExamsPath = path.join(newDataPath, "exams")
      await fs.mkdir(newExamsPath, { recursive: true })

      // 試験フォルダをコピー
      const examDirs = await fs.readdir(oldExamsPath)
      for (const examDir of examDirs) {
        const oldPath = path.join(oldExamsPath, examDir)
        const newPath = path.join(newExamsPath, examDir)
        await copyDirectory(oldPath, newPath)
      }

      // 旧フォルダを削除
      await fs.rm(oldExamsPath, { recursive: true, force: true })
      hasMigrated = true
    } catch {
      // 旧データが存在しない場合はスキップ
    }

    // データベースファイルの移行
    try {
      await fs.access(oldDbPath)

      const newDbPath = path.join(newDataPath, "database.db")
      await fs.copyFile(oldDbPath, newDbPath)
      await fs.unlink(oldDbPath)

      hasMigrated = true
    } catch {
      // 旧データベースが存在しない場合はスキップ
    }

    return hasMigrated
  } catch (error) {
    console.error("Migration failed:", error)
    return false
  }
}

// ディレクトリの再帰的コピー
const copyDirectory = async (src: string, dest: string): Promise<void> => {
  await fs.mkdir(dest, { recursive: true })

  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

// データディレクトリのサイズ計算
export const calculateDataSize = async (): Promise<number> => {
  const dataDir = getDataDirectory()
  return await getDirectorySize(dataDir)
}

// ディレクトリサイズの再帰計算
const getDirectorySize = async (dirPath: string): Promise<number> => {
  let totalSize = 0

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath)
      } else {
        const stats = await fs.stat(fullPath)
        totalSize += stats.size
      }
    }
  } catch {
    // ディレクトリが存在しない場合など
    console.warn("Could not read directory:", dirPath)
  }

  return totalSize
}

// ファイルサイズをフォーマット
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

// 絶対パスから相対パス（data/基準）への変換
export const getRelativePathFromData = (absolutePath: string): string => {
  const dataDir = getDataDirectory()
  return path.relative(dataDir, absolutePath).replace(/\\/g, "/")
}

// 相対パス（data/基準）から絶対パスへの変換
export const getAbsolutePathFromData = (relativePath: string): string => {
  const dataDir = getDataDirectory()
  return path.join(dataDir, relativePath)
}
