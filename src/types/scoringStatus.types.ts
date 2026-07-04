/**
 * 採点ステータスの唯一の定義源（Single Source of Truth）。
 *
 * SQLite は Prisma の enum をサポートしないため `QuestionScore.status` 等は `String` 型で
 * 保存され、値の集合を型で保証できるのはこの TypeScript 定義のみ。scoring / export /
 * 表示色など全レイヤーがこの1ファイルから `ScoringStatus` を導出すること
 * （各所での union 手書き重複は禁止 — 過去に hold/pending のドリフトを生んだ原因）。
 *
 * 「保留」は `pending`（export/描画層で "hold" と別名にしない）。
 */
export const SCORING_STATUSES = [
  "unscored",
  "correct",
  "incorrect",
  "partial",
  "pending",
  "no_answer",
  "double_mark",
] as const

export type ScoringStatus = (typeof SCORING_STATUSES)[number]

/** 任意の値が採点状態（ScoringStatus）かを判定する型ガード */
export function isScoringStatus(value: unknown): value is ScoringStatus {
  return (
    typeof value === "string" &&
    (SCORING_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * DB/JSON由来のstatus文字列を安全にScoringStatusへ変換する。
 * QuestionScore.status は常に7値のいずれか（保留=pending）だが、
 * 想定外値は未採点(unscored)にフォールバックする。
 */
export function toScoringStatus(
  value: string | null | undefined
): ScoringStatus {
  return isScoringStatus(value) ? value : "unscored"
}
