/**
 * 「別の試験として取り込む」（別で追加）で作る試験の名前。
 *
 * 同じ名前の試験が取り込み先に既にあれば ` (2)`、それも在れば ` (3)` … を付ける。
 * **試験名に unique は無く、これは制約を満たすためのものではない。** 取り込みは元の日時を
 * 引き継ぐので、同じ試験を別物として取り込むと一覧に同じ見た目の2行が並ぶ。どちらが取り込んだ
 * 方かを名前で見分けられるようにするための添え字。
 *
 * @param examName - アーカイブの試験名
 * @param isNameTaken - その名前の試験が取り込み先に在るか
 * @returns 取り込み先のどの試験とも同じでない名前（ぶつからなければ元の名前）
 */
export async function separateExamName(
  examName: string,
  isNameTaken: (candidateName: string) => Promise<boolean>
): Promise<string> {
  if (!(await isNameTaken(examName))) return examName
  let number = 2
  while (await isNameTaken(`${examName} (${number})`)) number++
  return `${examName} (${number})`
}
