/**
 * 同期の遅れで食い違った自分の点の直し（docs/vlm-grading-design.md §4-6 の2段落目）。
 *
 * 別の端末が古い項目・適用で計算した点を書くことがある。開いている設問の計算し直しの材料
 * （`rubricRecalculationSourceQuery`）を読むたびに、**自分の採点行だけ**を今の設問と項目で
 * 計算し、保存されている点と食い違う行があれば書き直す。自分の行なので確認は出さない。
 *
 * 材料は main の1回の読み取りで設問・項目・適用・採点行がそろうので、別々に読んだキャッシュを
 * 突き合わせて「片方だけ新しい」状態から誤った点を書くことはない。
 *
 * 書き込みが続かないように:
 * - 食い違いが無ければ書かない（書いたあとの読み直しで食い違いは消える）
 * - 何かの書き込みが走っている間・材料の読み直しの間は待つ（当てた直後の点の書き込みと
 *   重ならないように）
 * - 同じ食い違いの組は、開いている間に1回しか書かない（main が飛ばした・失敗した行を
 *   読み直すたびに書き直さない）
 */

import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef } from "react"
import { toast } from "sonner"

import {
  rubricRecalculationSourceQuery,
  writeRubricScoresMutation,
} from "@/queries/rubric"

import {
  planRubricRecalculation,
  toRubricRecalculationSource,
  toRubricScoreWrites,
} from "../utils/rubricRecalculation"

interface UseRubricSyncLagRepairOptions {
  examId: string
  cropRegionId: string
  currentUserId: string
}

export function useRubricSyncLagRepair({
  examId,
  cropRegionId,
  currentUserId,
}: UseRubricSyncLagRepairOptions) {
  const { data: source, isFetching } = useQuery(
    rubricRecalculationSourceQuery(examId, cropRegionId)
  )
  const mutatingCount = useIsMutating()
  const { mutateAsync: writeScores } = useMutation(
    writeRubricScoresMutation(examId)
  )

  const changes = useMemo(
    () =>
      source
        ? planRubricRecalculation(toRubricRecalculationSource(source), {
            scorerUserId: currentUserId,
          })
        : [],
    [source, currentUserId]
  )

  /** 書いた食い違いの組（開いている間だけ覚える。描画には使わない） */
  const attemptedSignatures = useRef(new Set<string>())

  useEffect(() => {
    if (changes.length === 0 || isFetching || mutatingCount > 0) return
    const signature = changes
      .map(
        (change) =>
          `${change.questionScoreId}:${change.before.status}:${change.before.partialScore}:${change.before.scaleLevelId}>${change.after.status}:${change.after.partialScore}:${change.after.scaleLevelId}`
      )
      .sort()
      .join("|")
    if (attemptedSignatures.current.has(signature)) return
    attemptedSignatures.current.add(signature)

    writeScores(toRubricScoreWrites(changes))
      .then((result) => {
        const writtenCount = result.writtenQuestionScoreIds.length
        if (writtenCount > 0) {
          toast.info(
            `同期の遅れで項目と食い違っていた自分の点を${writtenCount}件、計算し直しました`
          )
        }
      })
      .catch(() => {
        // 失敗の通知と取り直しは MutationCache の後始末が担う
      })
  }, [changes, isFetching, mutatingCount, writeScores])
}
