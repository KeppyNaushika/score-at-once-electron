import type { WebContents } from "electron"

import {
  holdGradeWriteLock,
  releaseGradeWriteLock,
  releaseGradeWriteLockOf,
} from "../lib/prisma/gradeWriteLock"
import { type HandlerMap, withEvent } from "./ipcHandlerUtils"

/** 手放し忘れの見張りを付けた画面（webContents の id） */
const watchedOwners = new Set<number>()

/**
 * 握った画面が閉じる・読み込み直す・別のページへ移ると、その画面のロックを外す。
 *
 * renderer は layout の後始末で手放すが、画面ごと消えたときは後始末が走らない。
 * 握りっぱなしになると、どの画面からも成績算出の入力を書けなくなる。
 * Next.js の画面遷移（同じ文書の中の遷移）では外さない。
 */
const watchOwner = (sender: WebContents): void => {
  const ownerId = sender.id
  if (watchedOwners.has(ownerId)) return
  watchedOwners.add(ownerId)
  sender.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) {
      releaseGradeWriteLockOf(ownerId)
    }
  })
  sender.on("render-process-gone", () => releaseGradeWriteLockOf(ownerId))
  sender.once("destroyed", () => {
    releaseGradeWriteLockOf(ownerId)
    watchedOwners.delete(ownerId)
  })
}

/** 成績算出のロック（`electron-src/lib/prisma/gradeWriteLock.ts`）を renderer から握る・手放す */
export const gradeLockHandlers = {
  "grade-lock:hold": withEvent((event, token: string) => {
    watchOwner(event.sender)
    holdGradeWriteLock(token, event.sender.id)
  }),

  "grade-lock:release": (token: string) => {
    releaseGradeWriteLock(token)
  },
} satisfies HandlerMap
