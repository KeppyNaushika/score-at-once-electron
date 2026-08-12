import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import { queryKeys } from "@/lib/queryKeys"
import type {
  GradeCalculationResult,
  GradeCellTarget,
  GradeOverrideInput,
} from "@/types/grade.types"

/**
 * 成績評定の計算結果取得、評定上書き（オーバーライド）、成績値の確定（凍結）を管理するフック。
 *
 * 評価フローは「自動算出 → 手動上書きで調整 → その実効値で確定」。確定値は算出時に
 * 最優先で採用されるため、確定済みセルの上書きを変えたときはその場で再確定する
 * （そうしないと調整が画面に出ない）。
 */
export function useGradeResults(gradeId: string) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = queryKeys.grade.results(gradeId)
  const {
    data: result = null,
    isPending: loading,
    error: queryError,
  } = useQuery({
    queryKey,
    queryFn: () => window.electronAPI.grade.calculateGrades(gradeId),
  })
  /** 書き込み（上書き・確定）の失敗。取得の失敗は useQuery が持つ */
  const [mutationError, setMutationError] = useState<string | null>(null)
  const error = mutationError ?? queryError?.message ?? null

  /**
   * 再計算する。取得中の表示は useQuery が持つので、1セルの操作で画面全体が
   * 「計算中...」に差し替わることはない（再取得中も前の結果が残る）。
   */
  const calculate = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  // 公開する再計算は引数なし（onClick へそのまま渡せる形を保つ）
  const recalculate = calculate

  const setGradeOverride = useCallback(
    async (params: GradeOverrideInput) => {
      if (!result) return

      // 確定済みセルは確定値が最優先なので、上書きを保存しただけでは表示が動かない。
      // 調整の結果をその場で取り込み直す（＝そのセルだけ再確定）必要がある。
      const editedItemResult = result.students
        .find((student) => student.gradeStudentId === params.gradeStudentId)
        ?.gradeItemResults.find(
          (gradeItemResult) =>
            gradeItemResult.gradeItemId === params.gradeItemId
        )
      const wasFrozen = Boolean(editedItemResult?.frozen)

      // 楽観的更新（再確定が要る場合は確定後の再計算で反映するので行わない）
      if (!wasFrozen) {
        queryClient.setQueryData<GradeCalculationResult>(queryKey, (prev) => {
          if (!prev) return prev
          return {
            ...prev,
            students: prev.students.map((student) => {
              if (student.gradeStudentId !== params.gradeStudentId)
                return student

              return {
                ...student,
                gradeItemResults: student.gradeItemResults.map((item) => {
                  if (item.gradeItemId !== params.gradeItemId) return item
                  const effectiveLabel =
                    params.overrideLabel ?? item.originalGradeLabel
                  return {
                    ...item,
                    gradeLabel: effectiveLabel,
                    overrideGradeLabel: params.overrideLabel,
                  }
                }),
              }
            }),
          }
        })
      }

      // DB 永続化。失敗は例外で届くので、書けていない上書きが楽観更新のまま
      // 画面に残り続けることはない（catch で再計算して実DBへ戻す）。
      try {
        if (params.overrideLabel) {
          await window.electronAPI.grade.upsertGradeOverride({
            gradeStudentId: params.gradeStudentId,
            gradeItemId: params.gradeItemId,
            overrideLabel: params.overrideLabel,
          })
        } else {
          await window.electronAPI.grade.deleteGradeOverride({
            gradeStudentId: params.gradeStudentId,
            gradeItemId: params.gradeItemId,
          })
        }

        if (wasFrozen) {
          await window.electronAPI.grade.freezeGradeScores({
            gradeId,
            targets: [
              {
                gradeStudentId: params.gradeStudentId,
                gradeItemId: params.gradeItemId,
              },
            ],
            frozenByUserId: user?.id ?? null,
          })
          await calculate()
        }
      } catch (err) {
        console.error("Error persisting grade override:", err)
        setMutationError(
          err instanceof Error ? err.message : "評定の保存に失敗しました"
        )
        // エラー時は再計算して整合性を回復
        await calculate()
      }
    },
    [gradeId, result, calculate, user, queryClient, queryKey]
  )

  /**
   * 成績値を確定（凍結）する。targets 未指定なら Grade 全体を一括確定。
   * 既に確定済みのセルを含めれば、その時点のライブ値で確定し直す（再確定）。
   */
  const freezeScores = useCallback(
    async (targets?: GradeCellTarget[]) => {
      try {
        await window.electronAPI.grade.freezeGradeScores({
          gradeId,
          targets,
          frozenByUserId: user?.id ?? null,
        })
        await calculate()
      } catch (err) {
        console.error("Error freezing grade scores:", err)
        setMutationError(
          err instanceof Error ? err.message : "成績値の確定に失敗しました"
        )
      }
    },
    [gradeId, calculate, user]
  )

  /** 成績値の確定を解除する。targets 未指定なら Grade 全体を一括解除 */
  const unfreezeScores = useCallback(
    async (targets?: GradeCellTarget[]) => {
      try {
        await window.electronAPI.grade.unfreezeGradeScores({
          gradeId,
          targets,
          userId: user?.id ?? null,
        })
        await calculate()
      } catch (err) {
        console.error("Error unfreezing grade scores:", err)
        setMutationError(
          err instanceof Error ? err.message : "確定の解除に失敗しました"
        )
      }
    },
    [gradeId, calculate, user]
  )

  return {
    result,
    loading,
    error,
    recalculate,
    setGradeOverride,
    freezeScores,
    unfreezeScores,
  }
}
