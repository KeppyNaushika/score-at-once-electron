/**
 * 書き出しファイルの名前。
 *
 * 解答用紙と模範解答を別のファイルに出すとき、利用者が選んだ保存先を土台にして
 * 模範解答の側の名前を作る。**保存先は1回しか訊かない**（2回訊くと、片方だけ選んで
 * もう片方を取り消す、という中途半端な結果を作れてしまう）。
 */

/** 模範解答のファイルに付ける接尾辞 */
export const MODEL_ANSWER_SUFFIX = "_模範解答"

/**
 * 拡張子の手前に接尾辞を差し込む（`解答用紙.pdf` → `解答用紙_模範解答.pdf`）。
 *
 * 探すのは**最後の区切りより後ろにある点**だけ。`/dir.v2/解答用紙` のように途中の
 * ディレクトリ名に点があると、素朴に最後の点を探した場合そこを拡張子と誤認する。
 * 区切りは `/` と `\` の両方を見る（Windows の保存先）。
 */
export function withFileNameSuffix(filePath: string, suffix: string): string {
  const separatorIndex = Math.max(
    filePath.lastIndexOf("/"),
    filePath.lastIndexOf("\\")
  )
  const dotIndex = filePath.lastIndexOf(".")
  if (dotIndex <= separatorIndex + 1) return filePath + suffix
  return filePath.slice(0, dotIndex) + suffix + filePath.slice(dotIndex)
}
