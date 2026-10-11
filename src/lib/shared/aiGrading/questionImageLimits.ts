/**
 * プロンプトの問題の画像（docs/vlm-grading-design.md §3-1）の受け付けの決まり。
 *
 * 画面（選ぶ前の絞り込みと案内）と main（保存の前の検証）の両方から引くので `src/lib/shared/` に置く。
 */

/** 取り込める元のファイルの大きさの上限（バイト。PDF も含む） */
export const AI_QUESTION_IMAGE_MAX_SOURCE_BYTES = 30 * 1024 * 1024

/**
 * 保存する画像1枚の大きさの上限（バイト）。事業者が画像1枚に課す上限（Anthropic は 5MB）に
 * 合わせる。超えるものは JPEG にして縮め、それでも超えれば受け付けない
 */
export const AI_QUESTION_IMAGE_MAX_SAVED_BYTES = 5 * 1024 * 1024

/** 保存する画像の一辺の上限（画素）。超えるものは縮めて保存する（Anthropic の上限） */
export const AI_QUESTION_IMAGE_MAX_SIDE = 8000

/** ファイルを選ぶときに受け付ける種類（PDF は画面でページを選んで画像にしてから送る） */
export const AI_QUESTION_IMAGE_ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const
