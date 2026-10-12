/**
 * 画面で選ばれたファイル（`stageFile`。`web/ipcProtocol.ts`）を、仮想パスに結び付けて持つ。
 *
 * 中身は読むときに `File` から読む（OPFS へは写さない）。`File` はブラウザが元のファイルを
 * 指したまま持つので、大きな PDF でもメモリに展開しない。
 */
import * as path from "path"

const stagedFiles = new Map<string, File>()

export function stageFile(filePath: string, file: File): void {
  stagedFiles.set(path.normalize(filePath), file)
}

/** そのパスに結び付けた `File`。無ければ null */
export function findStagedFile(filePath: string): File | null {
  return stagedFiles.get(path.normalize(filePath)) ?? null
}
