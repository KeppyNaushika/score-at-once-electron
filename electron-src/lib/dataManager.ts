import { app } from "electron"
import * as fs from "fs"
import * as fsPromises from "fs/promises"
import * as path from "path"

import { getStorageRoots } from "./storageRoots"

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

/**
 * PCに残すものの根（実行ファイルの隣の `data`）を返す。環境変数 `SCORE_AT_ONCE_DATA_DIR` が優先。
 *
 * 設定（`sync-config.json`）・出力・共有モードの手元の控え（`shared/<識別id>/`）・
 * ログはここに置く。**モードによらず同じ場所**なので、根が決まる前（起動の準備の途中）
 * から呼んでよい。
 *
 * DB と画像の置き場はモードで変わるので、ここからは導かない。DB は
 * `getStorageRoots().databasePath`、画像は {@link getSharedFilesDirectory} を使う。
 */
export const getLocalDataDirectory = (): string => {
  if (process.env.SCORE_AT_ONCE_DATA_DIR) {
    return path.resolve(process.env.SCORE_AT_ONCE_DATA_DIR)
  }
  return path.join(getAppRootPath(), "data")
}

/**
 * 共有するファイル（答案・模範解答・ASB の画像）の根を返す。
 *
 * ローカルモードは `data`、共有モードは `<共有フォルダ>/files`。起動時に決まった根から
 * 読むので、動いている間は変わらない（`storageRoots.ts`）。DB の `imagePath` はここからの
 * 相対パスで持つ。
 */
export const getSharedFilesDirectory = (): string =>
  getStorageRoots().sharedFilesDirectory

/** 指定した試験IDのディレクトリパスを取得する */
export const getExamDirectory = (examId: string): string => {
  return path.join(getSharedFilesDirectory(), "exams", examId)
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
    getSharedFilesDirectory(),
    "answer-sheet-builder",
    definitionId,
    "images"
  )
}

/** Excel・PDF等の出力ファイル保存ディレクトリのパスを取得する（PCに残す） */
const getExportsDirectory = (): string => {
  return path.join(getLocalDataDirectory(), "exports")
}

/**
 * 根のディレクトリを作る。PCに残すもの（`data`・`exports`）と、共有するファイルの
 * `exams` を用意する。根が決まったあとに呼ぶ。
 */
export const initializeDataDirectory = async (): Promise<void> => {
  const dataDir = getLocalDataDirectory()

  try {
    await fsPromises.mkdir(dataDir, { recursive: true, mode: 0o755 })
    await fsPromises.mkdir(getExportsDirectory(), {
      recursive: true,
      mode: 0o755,
    })
    await fsPromises.mkdir(path.join(getSharedFilesDirectory(), "exams"), {
      recursive: true,
      mode: 0o755,
    })
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
  const dataDir = getSharedFilesDirectory()
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

/** 絶対パスを、共有するファイルの根からの相対パス（DB の `imagePath` の形）に変換する */
export const getRelativePathFromSharedFiles = (absolutePath: string): string =>
  path.relative(getSharedFilesDirectory(), absolutePath).replace(/\\/g, "/")

/** 共有するファイルの根からの相対パス（DB の `imagePath`）を絶対パスに変換する */
export const getAbsolutePathFromSharedFiles = (relativePath: string): string =>
  path.join(getSharedFilesDirectory(), relativePath)
