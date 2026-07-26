/**
 * @fileoverview 答案の採点領域の「白さ」（空欄らしさ）の型定義
 * @description グリッド採点の白さ順ソート用。メインプロセスで算出しIPCで受け渡す。
 */

/** 白さを測る採点領域（答案画像に対する0-1相対座標） */
export interface WhitenessTargetRegion {
  cropRegionId: string
  x: number
  y: number
  width: number
  height: number
}

/** 白さの測定対象となる答案画像 */
export interface WhitenessTargetAnswerImage {
  studentAnswerImageId: string
  /** データディレクトリからの相対パス、または絶対パス */
  imagePath: string
}

/** 1つの採点領域の白さ */
export interface RegionWhiteness {
  cropRegionId: string
  /** 平均輝度（0-255）。大きいほど白い＝空欄に近い */
  meanLuminance: number
}

/** 1枚の答案画像について、対象ページの全採点領域の白さ */
export interface AnswerWhiteness {
  studentAnswerImageId: string
  regions: RegionWhiteness[]
}
