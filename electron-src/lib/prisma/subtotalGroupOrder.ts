/**
 * 小計点グループの並び（SSOT）。小計点管理・4. 設問グループ・Excel・個人成績表・
 * タグ・成績算出のどこで並べても同じ順になるよう、並べる箇所はすべてここを使う。
 */

import type { Prisma } from "@prisma/client"

/**
 * order の昇順、同じ値どうしは作った日時の新しい順。
 *
 * 列を足す前のグループは order がすべて 0 なので、今までの小計点管理の並び（新しい順）のまま。
 * 新しく作るグループも 0 で作るので、並べ替えたあとでも一番上に来る。
 * 採点マークの色の優先もこの並びで決まる（src/lib/subtotalMarkColor.ts）
 */
export const subtotalGroupDisplayOrderBy = [
  { order: "asc" },
  { createdAt: "desc" },
] satisfies Prisma.SubtotalGroupOrderByWithRelationInput[]

/** 中間表（ExamSubtotalGroup・TagSubtotalGroup）から、つないだ先のグループの並びで並べる */
export const linkedSubtotalGroupDisplayOrderBy =
  subtotalGroupDisplayOrderBy.map((subtotalGroupOrderBy) => ({
    subtotalGroup: subtotalGroupOrderBy,
  }))
