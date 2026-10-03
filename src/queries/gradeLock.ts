/**
 * 成績算出のロックを main で握る・手放す（`electron-src/lib/prisma/gradeWriteLock.ts`）。
 *
 * DB は書かず、書き込みの宣言（`defineMutation`）も通さない。握っている間、main が
 * 成績算出の読むテーブルへの書き込みを断る。
 */

/**
 * ロックを握る。戻り値は手放す関数（`useEffect` の後始末にそのまま返す）。
 *
 * 印はこちらで決めるので、握る問い合わせの返事を待たずに手放せる。main は印が
 * 違う手放しを無視するので、別の試験へ移ったときに前の後始末が後から届いても、
 * 新しく握ったロックは外れない。
 */
export function holdGradeWriteLock(): () => void {
  const token = crypto.randomUUID()
  const { gradeLock } = window.electronAPI
  gradeLock.hold(token).catch((error: unknown) => {
    console.error("成績算出のロックを握れませんでした:", error)
  })
  return () => {
    gradeLock.release(token).catch((error: unknown) => {
      console.error("成績算出のロックを手放せませんでした:", error)
    })
  }
}
