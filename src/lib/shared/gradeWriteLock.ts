/**
 * 成績算出のロックで書き込みを断ったことを、main から renderer へ伝える取り決め。
 *
 * main（`electron-src/lib/prisma/gradeWriteLock.ts`）は断った例外に `code` を付ける。
 * IPC の境界（`registerChannel`）はその `code` を見て、文言をこの定数に置き換えて渡す。
 * renderer は文言がこれと一致するかで見分ける。
 *
 * 文言で見分けるのは、preload から renderer へ渡る例外は `contextBridge` を通り、
 * `message` 以外の独自のプロパティ（`code` など）が落ちるため。部分一致にはしない。
 */

/** main が断った例外に付ける印 */
export const GRADE_WRITE_LOCKED_CODE = "GRADE_WRITE_LOCKED"

/** 断ったときに renderer へ渡す文言。renderer はこれとの完全一致で見分ける */
export const GRADE_WRITE_LOCKED_MESSAGE =
  "成績算出で使われているため、ロックしています"
