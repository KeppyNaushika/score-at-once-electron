/**
 * 成績算出（Grade）で使われている試験・資料を開いている間の、書き込みのロック。
 *
 * **書き込みは画面ごとに塞がず、ここ1か所で止める。** 画面ごとに欄を塞ぐと、どの欄が
 * 点数に効くかを見分けることになり、必ず漏れる（設問の追加・種類の変更・答案の
 * 割り当て替えなども試験の合計点を変える）。書き込みはすべて `defineMutation` を通り
 * `MutationCache` へ来るので、そこでロック中かを見て、実行させずに断る
 * （`createAppQueryClient` の `onMutate`）。
 *
 * ロックを持つのは試験・資料の layout に置く `GradeLockProvider` で、使われていて
 * 解除していない間だけ `holdGradeWriteLock` で握る。layout を出る（別の試験へ移る）と
 * 手放す。解除の状態は DB にも localStorage にも書かない。
 *
 * 止めないのは次の2つだけ:
 * - DB を書かないもの（`writesDatabase: false`。出力・印刷・ファイル選択など）
 * - 試験・資料の中身を変えない書き込み（`bypassesGradeLock: true`。利用者の設定・
 *   出力設定・同期・監査ログだけを書くもの）
 */

import { toast } from "sonner"

import type { AppMutationMeta } from "@/queries/registerMeta"

/** ロック中に書こうとしたときの通知。キーを押し続けても1つに畳む */
const LOCKED_TOAST_ID = "grade-write-lock"

/** いまロックを握っているもの。握り直しで前の手放しが後から走っても外さないよう、印で持つ */
let heldBy: symbol | null = null

/**
 * ロックを握る。戻り値は手放す関数（`useEffect` の後始末にそのまま返す）。
 *
 * 開いている試験・資料は1つなので、握るのは1つだけ。後から握ったものが勝ち、
 * 先に握ったものの手放しは効かない。
 */
export function holdGradeWriteLock(): () => void {
  const token = Symbol("gradeWriteLock")
  heldBy = token
  return () => {
    if (heldBy === token) heldBy = null
  }
}

/** この書き込みをロックで止めるか */
export function isBlockedByGradeLock(
  meta: AppMutationMeta | undefined
): boolean {
  if (heldBy === null) return false
  // DB を書かないもの（出力・印刷など）は止めない
  if (meta?.writesDatabase === false) return false
  // meta の無い書き込みは型の上では作れないが、作られたら書くものとして止める
  return meta?.bypassesGradeLock !== true
}

/** ロックで断った書き込みの失敗。`MutationCache` はこれを失敗として扱わない */
export class GradeWriteLockedError extends Error {
  constructor() {
    super("成績算出で使われているため、ロックしています")
    this.name = "GradeWriteLockedError"
  }
}

/** ロック中に書こうとしたことを知らせる（画面上部の帯から解除できる） */
export function notifyGradeWriteLocked(): void {
  toast.info("成績算出で使われているため、ロックしています", {
    id: LOCKED_TOAST_ID,
    description: "編集するには、画面上部のロックを解除してください。",
  })
}
