import { bind } from "./invoke"

/** 成績算出のロックを main で握る・手放す IPC API（`gradeLockHandlers.ts`） */
export function createGradeLockApi() {
  return {
    gradeLock: {
      hold: bind("grade-lock:hold"),
      release: bind("grade-lock:release"),
    },
  }
}
