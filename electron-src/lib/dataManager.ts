import { app } from "electron"
import * as fs from "fs"
import * as fsPromises from "fs/promises"
import * as path from "path"

// アプリケーションのルートディレクトリ（実行ファイルがある場所）
const getAppRootPath = (): string => {
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

/** データディレクトリのパスを取得する（環境変数 SCORE_AT_ONCE_DATA_DIR が優先） */
export const getDataDirectory = (): string => {
  if (process.env.SCORE_AT_ONCE_DATA_DIR) {
    return path.resolve(process.env.SCORE_AT_ONCE_DATA_DIR)
  }
  const dataPath = path.join(getAppRootPath(), "data")
  return dataPath
}

/** 指定した試験IDのディレクトリパスを取得する */
export const getExamDirectory = (examId: string): string => {
  return path.join(getDataDirectory(), "exams", examId)
}

/** 指定した試験の答案画像保存ディレクトリのパスを取得する */
export const getAnswerSheetsDirectory = (examId: string): string => {
  return path.join(getExamDirectory(examId), "answer-sheets")
}

/** 指定した試験の模範解答画像保存ディレクトリのパスを取得する */
export const getMasterAnswersDirectory = (examId: string): string => {
  return path.join(getExamDirectory(examId), "master-answers")
}

/** 答案用紙ビルダー（ASB）の画像保存ディレクトリのパスを取得する */
export const getAsbImagesDirectory = (definitionId: string): string => {
  return path.join(
    getDataDirectory(),
    "answer-sheet-builder",
    definitionId,
    "images"
  )
}

/** Excel・PDF等の出力ファイル保存ディレクトリのパスを取得する */
const getExportsDirectory = (): string => {
  return path.join(getDataDirectory(), "exports")
}

/** データディレクトリとサブディレクトリ（exams, exports）を作成・初期化する */
export const initializeDataDirectory = async (): Promise<void> => {
  const dataDir = getDataDirectory()

  try {
    // 親ディレクトリの存在確認と作成
    const parentDir = path.dirname(dataDir)
    await fsPromises.mkdir(parentDir, { recursive: true, mode: 0o755 })

    // データディレクトリの作成
    await fsPromises.mkdir(dataDir, { recursive: true, mode: 0o755 })

    // サブディレクトリの作成
    const examsDir = path.join(dataDir, "exams")
    const exportsDir = getExportsDirectory()

    await fsPromises.mkdir(examsDir, { recursive: true, mode: 0o755 })
    await fsPromises.mkdir(exportsDir, { recursive: true, mode: 0o755 })
  } catch (error) {
    console.error("Failed to initialize data directory:", error)
    console.error("Data directory path:", dataDir)
    console.error("Process platform:", process.platform)
    console.error("App is packaged:", app.isPackaged)

    throw new Error(
      `Data directory initialization failed: ${error instanceof Error ? error.message : error}`,
      { cause: error }
    )
  }
}

/** data/projects/ を data/exams/ にマイグレーションする（v0.6.xリネーム対応、旧ディレクトリは削除される） */
export const migrateProjectsToExams = async (): Promise<boolean> => {
  const dataDir = getDataDirectory()
  const oldProjectsDir = path.join(dataDir, "projects")
  const newExamsDir = path.join(dataDir, "exams")

  try {
    await fsPromises.access(oldProjectsDir)
  } catch {
    // data/projects/ が存在しない場合はスキップ
    return false
  }

  try {
    // data/exams/ を作成
    await fsPromises.mkdir(newExamsDir, { recursive: true })

    // 各試験ディレクトリをコピー
    const examDirs = await fsPromises.readdir(oldProjectsDir)
    for (const dir of examDirs) {
      const oldPath = path.join(oldProjectsDir, dir)
      const newPath = path.join(newExamsDir, dir)

      // 移行先に既にある場合はスキップ
      try {
        await fsPromises.access(newPath)
        console.log(`Skipping already migrated exam directory: ${dir}`)
        continue
      } catch {
        // 存在しないのでコピー
      }

      await copyDirectory(oldPath, newPath)
    }

    // 旧ディレクトリを削除
    await fsPromises.rm(oldProjectsDir, { recursive: true, force: true })
    console.log(
      `Successfully migrated data/projects/ → data/exams/ (${examDirs.length} directories)`
    )
    return true
  } catch (error) {
    console.error("Failed to migrate projects to exams:", error)
    return false
  }
}

// ディレクトリの再帰的コピー
const copyDirectory = async (src: string, dest: string): Promise<void> => {
  await fsPromises.mkdir(dest, { recursive: true })

  const entries = await fsPromises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath)
    } else {
      await fsPromises.copyFile(srcPath, destPath)
    }
  }
}

/** データディレクトリ全体のサイズをバイト単位で再帰的に計算する */
export const calculateDataSize = async (): Promise<number> => {
  const dataDir = getDataDirectory()
  return await getDirectorySize(dataDir)
}

// ディレクトリサイズの再帰計算
const getDirectorySize = async (dirPath: string): Promise<number> => {
  let totalSize = 0

  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)

      if (entry.isDirectory()) {
        totalSize += await getDirectorySize(fullPath)
      } else {
        const stats = await fsPromises.stat(fullPath)
        totalSize += stats.size
      }
    }
  } catch {
    // ディレクトリが存在しない場合など
    console.warn("Could not read directory:", dirPath)
  }

  return totalSize
}

/** 絶対パスをデータディレクトリ基準の相対パスに変換する */
export const getRelativePathFromData = (absolutePath: string): string => {
  const dataDir = getDataDirectory()
  return path.relative(dataDir, absolutePath).replace(/\\/g, "/")
}

/** データディレクトリ基準の相対パスを絶対パスに変換する */
export const getAbsolutePathFromData = (relativePath: string): string => {
  const dataDir = getDataDirectory()
  return path.join(dataDir, relativePath)
}
