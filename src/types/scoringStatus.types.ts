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
import { defineStringUnion } from "./stringUnion"

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

/**
 * 型ガード `isScoringStatus` と境界コンバータ `toScoringStatus`（想定外値は未採点 unscored）。
 * QuestionScore.status は常に7値のいずれか（保留=pending）。
 */
export const { is: isScoringStatus, to: toScoringStatus } = defineStringUnion(
  SCORING_STATUSES,
  "unscored"
)

/**
 * DB に入りうる採点判定。**現行の7値に、未変換の旧データの値を足したもの。**
 *
 * `QuestionScore.status` は `String` 列なので、旧バージョンが書いた `"final"` /
 * `"proposed"` がそのまま残っている DB がありうる。得点化と確定リゾルバはこれらを
 * 現に扱っている（`final` は提案より優先し、`proposed` は部分点として読む）ので、
 * `ScoringStatus` へ絞ると**旧データの扱いが黙って消える**。
 *
 * **書く側は使わない。** 新しく書いてよいのは `ScoringStatus` の7値だけで、これは
 * 「読むときに出会いうる値」を表す型である。
 */
export const LEGACY_SCORING_STATUSES = ["final", "proposed"] as const

export type StoredScoringStatus =
  ScoringStatus | (typeof LEGACY_SCORING_STATUSES)[number]

/** DB/JSON 由来の文字列を `StoredScoringStatus` へ絞る（想定外値は未採点） */
export const { is: isStoredScoringStatus, to: toStoredScoringStatus } =
  defineStringUnion<StoredScoringStatus>(
    [...SCORING_STATUSES, ...LEGACY_SCORING_STATUSES],
    "unscored"
  )
