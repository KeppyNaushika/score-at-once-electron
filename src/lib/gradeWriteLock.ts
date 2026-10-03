/**
 * 成績算出のロックで書き込みが断られたときの、renderer 側の知らせ方。
 *
 * 止めるのは main（`electron-src/lib/prisma/gradeWriteLock.ts`）で、成績算出が読む
 * テーブルへの書き込みだけを DB の手前で断る。renderer は書き込みを分類しない。
 * 断られた書き込みは `MutationCache` の `onError` がここで見分け、失敗ではなく
 * ロックの知らせとして1つに畳んで出す。
 */

import { toast } from "sonner"

import { GRADE_WRITE_LOCKED_MESSAGE } from "@/lib/shared/gradeWriteLock"

/** ロック中に書こうとしたときの通知。キーを押し続けても1つに畳む */
const LOCKED_TOAST_ID = "grade-write-lock"

/** 書き込みの失敗が、成績算出のロックで断られたものか */
export function isGradeWriteLockedError(error: unknown): boolean {
  return error instanceof Error && error.message === GRADE_WRITE_LOCKED_MESSAGE
}

/** ロック中に書こうとしたことを知らせる（画面上部の帯から解除できる） */
export function notifyGradeWriteLocked(): void {
  toast.info(GRADE_WRITE_LOCKED_MESSAGE, {
    id: LOCKED_TOAST_ID,
    description: "編集するには、画面上部のロックを解除してください。",
  })
}
