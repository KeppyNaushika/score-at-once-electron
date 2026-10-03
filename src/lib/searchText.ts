/**
 * 絞り込みに使う形へ揃える。全角英数・全角空白は半角へ（NFKC）、英字は小文字へ、
 * カタカナはひらがなへ寄せる。カナの列はカタカナで持っている一方、打つときは
 * ひらがなのまま確定しがちなので、どちらで打っても引っかかるようにする。
 */
export function normalizeForSearch(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (katakana) =>
      String.fromCharCode(katakana.charCodeAt(0) - 0x60)
    )
}

/** 照合用に、揃えたうえで空白を全部抜く */
function compactForSearch(text: string): string {
  return normalizeForSearch(text).replace(/\s+/g, "")
}

/**
 * 検索語が、対象の文字列のどれかに含まれるか。
 *
 * **空白は全角・半角・無しを区別しない。** 両側から空白を抜いてから比べるので、
 * 「山田太郎」でも「山田 太郎」でも全角空白入りでも、「山田 太郎」にも
 * 「山田太郎」にも引っかかる。検索語が空（空白だけを含む）なら全部を通す。
 *
 * @param searchTerm - 欄に打たれた文字列
 * @param texts - 照合する相手（氏名・カナ・番号など）。null は飛ばす
 */
export function matchesSearchTerm(
  searchTerm: string,
  texts: readonly (string | null | undefined)[]
): boolean {
  const compactTerm = compactForSearch(searchTerm)
  if (compactTerm === "") return true
  return texts.some(
    (text) =>
      text !== null &&
      text !== undefined &&
      compactForSearch(text).includes(compactTerm)
  )
}
