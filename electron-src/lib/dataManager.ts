import { app } from "electron"
import * as path from "path"
import * as fs from "fs/promises"

// アプリケーションのルートディレクトリ（実行ファイルがある場所）
const getAppRootPath = (): string => {
  if (app.isPackaged) {
    // パッケージ化されている場合
    return path.dirname(app.getPath("exe"))
  } else {
    // 開発環境の場合
    return process.cwd()
  }
}

// データディレクトリのパス
export const getDataDirectory = (): string => {
  return path.join(getAppRootPath(), "data")
}

// プロジェクトディレクトリのパス
export const getProjectDirectory = (projectId: string): string => {
  return path.join(getDataDirectory(), "projects", projectId)
}

// 答案保存ディレクトリのパス
export const getAnswerSheetsDirectory = (projectId: string): string => {
  return path.join(getProjectDirectory(projectId), "answer-sheets")
}

// マスター画像保存ディレクトリのパス
export const getMasterImagesDirectory = (projectId: string): string => {
  return path.join(getProjectDirectory(projectId), "master-images")
}

// 出力ディレクトリのパス
export const getExportsDirectory = (): string => {
  return path.join(getDataDirectory(), "exports")
}

// データディレクトリの初期化
export const initializeDataDirectory = async (): Promise<void> => {
  const dataDir = getDataDirectory()

  try {
    // 必要なディレクトリを作成
    await fs.mkdir(dataDir, { recursive: true })
    await fs.mkdir(path.join(dataDir, "projects"), { recursive: true })
    await fs.mkdir(getExportsDirectory(), { recursive: true })
  } catch (error) {
    console.error("Failed to initialize data directory:", error)
    throw error
  }
}

// ApplicationSupportからの移行処理
export const migrateFromApplicationSupport = async (): Promise<boolean> => {
  const oldDataPath = path.join(app.getPath("userData"))
  const newDataPath = getDataDirectory()

  try {
    // 旧データの存在確認
    const oldProjectsPath = path.join(oldDataPath, "projects")
    const oldDbPath = path.join(oldDataPath, "database.db")

    let hasMigrated = false

    // プロジェクトフォルダの移行
    try {
      await fs.access(oldProjectsPath)

      const newProjectsPath = path.join(newDataPath, "projects")
      await fs.mkdir(newProjectsPath, { recursive: true })

      // プロジェクトフォルダをコピー
      const projectDirs = await fs.readdir(oldProjectsPath)
      for (const projectDir of projectDirs) {
        const oldPath = path.join(oldProjectsPath, projectDir)
        const newPath = path.join(newProjectsPath, projectDir)
        await copyDirectory(oldPath, newPath)
      }

      // 旧フォルダを削除
      await fs.rm(oldProjectsPath, { recursive: true, force: true })
      hasMigrated = true
    } catch (error) {
      // 旧データが存在しない場合はスキップ
    }

    // データベースファイルの移行
    try {
      await fs.access(oldDbPath)

      const newDbPath = path.join(newDataPath, "database.db")
      await fs.copyFile(oldDbPath, newDbPath)
      await fs.unlink(oldDbPath)

      hasMigrated = true
    } catch (error) {
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
  } catch (error) {
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
