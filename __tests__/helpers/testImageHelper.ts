/**
 * テスト用画像ヘルパー
 *
 * テスト用の最小PNGファイルと画像ディレクトリ構造を作成
 */

import * as fs from "fs"
import * as path from "path"

/**
 * 最小の1x1 PNGバッファを生成（68バイト固定）
 */
export function createMinimalPngBuffer(): Buffer {
  // 1x1 transparent PNG (68 bytes)
  return Buffer.from(
    "89504e470d0a1a0a0000000d4948445200000001000000010800000000" +
      "3a7e9b550000000a49444154789c626000000002000198e195280000" +
      "000049454e44ae426082",
    "hex"
  )
}

/**
 * 最小PNGファイルを作成
 */
export function createMinimalPng(filePath: string): void {
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(filePath, createMinimalPngBuffer())
}

/**
 * テスト用の画像ファイル構造を作成
 *
 * baseDir/
 *   projects/{projectId}/
 *     master-images/
 *       page1.png, page2.png, ...
 *     answer-sheets/
 *       {studentNumber}_page1.png, ...
 */
export function createTestImageFiles(
  baseDir: string,
  projectId: string,
  pageCount: number,
  studentNumbers: string[]
): { masterImagePaths: string[]; answerSheetPaths: string[] } {
  const masterImagePaths: string[] = []
  const answerSheetPaths: string[] = []

  // マスター画像
  for (let i = 1; i <= pageCount; i++) {
    const relativePath = `projects/${projectId}/master-images/page${i}.png`
    const absolutePath = path.join(baseDir, relativePath)
    createMinimalPng(absolutePath)
    masterImagePaths.push(relativePath)
  }

  // 答案画像
  for (const studentNumber of studentNumbers) {
    for (let i = 1; i <= pageCount; i++) {
      const relativePath = `projects/${projectId}/answer-sheets/${studentNumber}_page${i}.png`
      const absolutePath = path.join(baseDir, relativePath)
      createMinimalPng(absolutePath)
      answerSheetPaths.push(relativePath)
    }
  }

  return { masterImagePaths, answerSheetPaths }
}

/**
 * 一時ディレクトリを削除
 */
export function cleanupTempDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  } catch {
    // ignore
  }
}
