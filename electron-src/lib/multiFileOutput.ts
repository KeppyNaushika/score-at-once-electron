/**
 * いくつものファイルを1つの置き場へ書き出す（PDF のページ別・PNG のページ別・解答用紙の
 * 複数ページの PNG）。
 *
 * デスクトップ版は、選んだフォルダへ1つずつ書く。web 版は、保存の領域
 * （`web/worker/downloadArea.ts`）へ書いたファイルが1つずつブラウザのダウンロードになり、
 * 続けて落とすと Chrome が「複数のファイルのダウンロード」の許可を求めるので、zip 1つに
 * まとめて、書き終えたときに1度だけ書く。
 */
import { type Zippable, zipSync } from "fflate"
import * as fsPromises from "fs/promises"
import * as path from "path"

import { isWebRuntime } from "@/lib/webRuntime"

export interface MultiFileOutput {
  /**
   * ファイルを1つ足す。返すのは、デスクトップ版は書いたファイルのパス、web 版は zip の中の
   * 位置（zip のパスの下にファイル名を足したもの。ファイルとしては無い）
   */
  add: (fileName: string, contents: Uint8Array) => Promise<string>
  /** 書き終える。web 版はここで zip を書く（1つも足していなければ書かない） */
  finish: () => Promise<void>
}

/** フォルダへ1つずつ書く（デスクトップ版） */
function createDirectoryOutput(outputDir: string): MultiFileOutput {
  return {
    add: async (fileName, contents) => {
      const outputPath = path.join(outputDir, fileName)
      await fsPromises.writeFile(outputPath, contents)
      return outputPath
    },
    finish: async () => {},
  }
}

/** 溜めておき、最後に zip 1つにして書く（web 版） */
function createZipOutput(zipPath: string): MultiFileOutput {
  const zipEntries: Zippable = {}
  return {
    add: async (fileName, contents) => {
      zipEntries[fileName] = contents
      return path.join(zipPath, fileName)
    },
    finish: async () => {
      if (Object.keys(zipEntries).length === 0) return
      // PNG・PDF の中身は既に圧縮されていてほとんど縮まないので、圧縮せずに入れる（速さを取る）
      await fsPromises.writeFile(zipPath, zipSync(zipEntries, { level: 0 }))
    },
  }
}

/**
 * 書き出し先を作る。`zipFileName` は web 版で `outputDir` の下に書く zip の名前
 * （デスクトップ版では使わない）
 */
export function createMultiFileOutput(
  outputDir: string,
  zipFileName: string
): MultiFileOutput {
  return isWebRuntime()
    ? createZipOutput(path.join(outputDir, zipFileName))
    : createDirectoryOutput(outputDir)
}
