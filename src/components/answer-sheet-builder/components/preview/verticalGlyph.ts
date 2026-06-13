/**
 * 縦書き原稿用紙のマス内字形調整
 *
 * 縦書きでは約物の見た目が横書きと異なるため、文字ごとに回転・位置を補正する。
 * 原稿用紙は「1文字=1マス中心配置」なので、マス中心 (cx,cy) に対する
 * 回転角度とオフセット比（セルサイズに対する割合）を返す純関数で表現する。
 *
 * - 90°回転: 長音符・各種括弧・ダッシュ類（横長グリフを縦向きにする）
 * - 右上寄せ: 拗促音（小書き仮名）と句読点（縦書きではマス右上に置く）
 */

export interface VerticalGlyphAdjust {
  /** 回転角度（度・時計回り）。0なら回転なし */
  rotate: number
  /** マス中心からのXオフセット（cellSizeMm に対する比） */
  dxRatio: number
  /** マス中心からのYオフセット（cellSizeMm に対する比） */
  dyRatio: number
}

const NO_ADJUST: VerticalGlyphAdjust = { rotate: 0, dxRatio: 0, dyRatio: 0 }

/** 縦書きで90°回転させる文字（長音符・括弧・ダッシュ類） */
const ROTATE_CHARS = new Set([
  ..."ー〜～…‥—―‐ｰ",
  ..."（）「」『』〔〕［］｛｝〈〉《》【】｜",
  ..."()[]{}<>",
])

/** 縦書きでマス右上に寄せる句読点 */
const TOP_RIGHT_PUNCT = new Set([..."、。，．"])

/** 縦書きでマス右上に寄せる小書き仮名（拗促音） */
const SMALL_KANA = new Set([
  ..."ぁぃぅぇぉっゃゅょゎゕゖ",
  ..."ァィゥェォッャュョヮヵヶ",
])

/**
 * 縦書きでの字形補正を返す。横書き時は常に NO_ADJUST を使うこと（呼び出し側で分岐）。
 */
export function verticalGlyphAdjust(char: string): VerticalGlyphAdjust {
  if (ROTATE_CHARS.has(char)) return { rotate: 90, dxRatio: 0, dyRatio: 0 }
  // 句読点は日本語縦書きのためマス右上へ（中国語のような中央下ではない）
  if (TOP_RIGHT_PUNCT.has(char))
    return { rotate: 0, dxRatio: 0.4, dyRatio: -0.4 }
  if (SMALL_KANA.has(char)) return { rotate: 0, dxRatio: 0.18, dyRatio: -0.18 }
  return NO_ADJUST
}
