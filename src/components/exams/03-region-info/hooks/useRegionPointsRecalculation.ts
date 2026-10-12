/**
 * 減点・加点方式の設問の配点を変えたときの、点の計算し直し（docs/vlm-grading-design.md §4-4・§4-6）。
 *
 * 配点は1打鍵ごとに書くので、計算し直しも1打鍵ごとに走る。確認はしない（打鍵ごとには聞けない）。
 * 材料（全採点者の、適用のある採点行）を読み直し、**その打鍵の配点**で点の変わる行を洗い出して書く。
 * 手での上書きの行は飛ばす。計算は renderer、main は材料を返して書くだけ。
 *
 * 速い打鍵どうしの競り合い:
 * - 計算し直しは設問ごとに1本の列に並べ、前の打鍵の分が書き終わってから次を始める。
 *   古い打鍵の点の書き込みが新しい打鍵の分より後に着地することは無い
 * - 列で待っている間に新しい打鍵が来た分は、材料も読まず書きもせずに飛ばす
 *   （新しい打鍵の分が、そのあとの材料で計算し直す）
 * - 配点そのものの書き込みは呼び出し側が打鍵ごとに即座に始める。計算し直しはその書き込みの
 *   終わりを待ち、配点を書けなかった打鍵では点を書かない（配点と点が食い違わないように）
 */

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef } from "react"
import { toast } from "sonner"

import { toRubricScoreWrites } from "@/components/exams/07-score-at-once/Rubric/utils/rubricRecalculation"
import {
  rubricRecalculationSourceQuery,
  writeRubricScoresMutation,
} from "@/queries/rubric"

import { planPointsRecalculation } from "../utils/regionPoints"

/** 設問1つぶんの計算し直しの列 */
interface RecalculationQueue {
  /** 最後に受け付けた打鍵の番号 */
  latestKeystroke: number
  /** 列の末尾（これが終われば、受け付けた分は全部終わっている） */
  tail: Promise<void>
}

export function useRegionPointsRecalculation(examId: string) {
  const queryClient = useQueryClient()
  const { mutateAsync: writeScores } = useMutation(
    writeRubricScoresMutation(examId)
  )
  const queuesRef = useRef(new Map<string, RecalculationQueue>())

  /**
   * 計算し直しを列に積む。`pointsWrite` はこの打鍵の配点の書き込み。
   * 戻りは、この打鍵の分が終わった（または飛ばした）とき
   */
  const recalculateForPoints = useCallback(
    (
      cropRegionId: string,
      nextPoints: number | null,
      pointsWrite: Promise<unknown>
    ): Promise<void> => {
      const queue = queuesRef.current.get(cropRegionId) ?? {
        latestKeystroke: 0,
        tail: Promise.resolve(),
      }
      const keystroke = queue.latestKeystroke + 1
      const isStale = () =>
        queuesRef.current.get(cropRegionId)?.latestKeystroke !== keystroke

      const run = async () => {
        try {
          await pointsWrite
        } catch {
          // 配点を書けなかった（失敗の通知は MutationCache の後始末が担う）。点も書かない
          return
        }
        if (isStale()) return
        try {
          const source = await queryClient.fetchQuery(
            rubricRecalculationSourceQuery(examId, cropRegionId)
          )
          if (isStale()) return
          const changes = planPointsRecalculation(source, nextPoints)
          if (changes.length === 0) return
          await writeScores(toRubricScoreWrites(changes))
        } catch {
          // 書き込みの失敗は MutationCache の後始末が知らせる。材料の読み込みの失敗は、
          // 打鍵ごとに積もらないよう同じ通知に畳む
          toast.error("配点を変えたあとの点を計算し直せませんでした", {
            id: `region-points-recalculation:${cropRegionId}`,
          })
        }
      }

      const tail = queue.tail.then(run)
      queuesRef.current.set(cropRegionId, {
        latestKeystroke: keystroke,
        tail,
      })
      return tail
    },
    [queryClient, examId, writeScores]
  )

  return { recalculateForPoints }
}
