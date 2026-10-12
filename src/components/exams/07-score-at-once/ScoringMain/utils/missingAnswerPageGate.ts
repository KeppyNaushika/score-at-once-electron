/**
 * 現在の設問のページが答案に無いときに、採点の書き込みを止める
 *
 * 個別表示で、設問のページの画像が表示中の生徒の答案に無いと、その設問の解答は
 * 画面に無い。見ていない答案に点を付けないよう、採点の口（キー・ボタン・類型・
 * ルーブリック項目）で書き込みを止める。移動・ズーム・パンは止めない。
 * 「無い」の判定は描画側の `isQuestionPageMissingFromAnswer` だけが持つ。
 */
import { toast } from "sonner"

/** 止めたときの知らせ（画面には「この設問のページは答案にありません」が出ている） */
export const MISSING_ANSWER_PAGE_NOTICE =
  "この設問のページは答案にありません。採点できません"

/** 採点を止めたことを知らせる（同じ id で出し直し、連打しても積もらない） */
export function notifyMissingAnswerPage() {
  toast.info(MISSING_ANSWER_PAGE_NOTICE, { id: "missing-answer-page" })
}

/**
 * ページが無ければ書き込みの代わりに知らせるだけにする包み
 *
 * @param isAnswerPageMissing - 現在の設問のページが答案に無いか
 * @param notify - 止めたことを知らせる（非中断的に）
 */
export function guardOnMissingAnswerPage(
  isAnswerPageMissing: boolean,
  notify: () => void
) {
  return <Args extends unknown[]>(write: (...args: Args) => void) =>
    (...args: Args): void => {
      if (isAnswerPageMissing) {
        notify()
        return
      }
      write(...args)
    }
}
