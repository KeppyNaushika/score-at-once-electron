import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

/**
 * 「数え直しでは中止しない」ことにするための件数（docs/remaining-work.md 段階26）。
 *
 * 削除は「利用者に見せた件数」を添えることを要求し、消す直前に数え直して**見せた
 * ときより増えていたら中止**する。中止そのものの検査は
 * `__tests__/exam/integration/deleteAfterRecount.test.ts` が受け持つので、削除の
 * 本体を確かめたい検査では全項目を上限で見せたことにして先へ進める。
 *
 * 逆に「見せた件数」を絞って渡せば、その項目が増えたときに中止されることを
 * 確かめられる。
 */
export const SAW_ALL_DELETION_COUNTS: ConfirmedDeletionCount[] = Object.values(
  DELETION_COUNT_NAME
).map((countedName) => ({
  countedName,
  shownCount: Number.MAX_SAFE_INTEGER,
}))
