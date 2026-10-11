import * as fsPromises from "fs/promises"

/**
 * ファイルかフォルダがあるか（`fs.existsSync` の非同期版）。
 *
 * main のファイル操作は非同期で書く。web 版の保存先（OPFS）にはファイルを同期で開く手段が
 * 無いため（`eslint.config.mjs` の同期 fs の禁止）。
 *
 * 「あるか確かめてから作る・消す」は、確かめてから操作するまでの間に別の処理が割り込める。
 * 作る・消すだけなら確かめずに `mkdir({ recursive: true })`・`rm({ force: true })` を使う
 */
export async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fsPromises.access(targetPath)
    return true
  } catch {
    return false
  }
}
