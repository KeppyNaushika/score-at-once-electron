import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/contexts/AuthContext"
import type { GradeCalculationResult } from "@/types/grade.types"

interface SetGradeOverrideParams {
  studentId: string
  gradeItemId: string
  /** 上書きラベル。null の場合は上書きを削除（自動計算に戻す） */
  overrideLabel: string | null
}

/** 確定・解除の対象セル（生徒×評価項目）。未指定なら Grade 全体が対象 */
export interface GradeFrozenTarget {
  studentId: string
  gradeItemId: string
}

/**
 * 成績評定の計算結果取得、評定上書き（オーバーライド）、成績値の確定（凍結）を管理するフック。
 *
 * 評価フローは「自動算出 → 手動上書きで調整 → その実効値で確定」。確定値は算出時に
 * 最優先で採用されるため、確定済みセルの上書きを変えたときはその場で再確定する
 * （そうしないと調整が画面に出ない）。
 */
export function useGradeResults(gradeId: string) {
  const { user } = useAuth()
  const [result, setResult] = useState<GradeCalculationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /**
   * @param options.silent ローディング表示を出さずに再取得する。確定・解除の直後の
   *   再計算で使う（1セルの操作で画面全体が「計算中...」に差し替わるのを避けるため）。
   */
  const calculate = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) setLoading(true)
      setError(null)
      try {
        const response = await window.electronAPI.grade.calculateGrades(gradeId)
        if (response.success && response.result) {
          setResult(response.result)
        } else {
          setError(response.error ?? "計算に失敗しました")
        }
      } catch (err) {
        console.error("Error calculating grades:", err)
        setError("計算中にエラーが発生しました")
      } finally {
        if (!options?.silent) setLoading(false)
      }
    },
    [gradeId]
  )

  // 公開する再計算は引数なし。silent は内部の都合なので外へ出さない
  // （onClick へそのまま渡せる形を保つ＝MouseEvent が options に化けない）。
  const recalculate = useCallback(() => calculate(), [calculate])

  useEffect(() => {
    calculate()
  }, [calculate])

  const setGradeOverride = useCallback(
    async (params: SetGradeOverrideParams) => {
      if (!result) return

      // 確定済みセルは確定値が最優先なので、上書きを保存しただけでは表示が動かない。
      // 調整の結果をその場で取り込み直す（＝そのセルだけ再確定）必要がある。
      const editedItemResult = result.students
        .find((student) => student.studentId === params.studentId)
        ?.gradeItemResults.find(
          (gradeItemResult) =>
            gradeItemResult.gradeItemId === params.gradeItemId
        )
      const wasFrozen = Boolean(editedItemResult?.frozen)

      // 楽観的更新（再確定が要る場合は確定後の再計算で反映するので行わない）
      if (!wasFrozen) {
        setResult((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            students: prev.students.map((student) => {
              if (student.studentId !== params.studentId) return student

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

      // DB 永続化
      try {
        if (params.overrideLabel) {
          await window.electronAPI.grade.upsertGradeOverride({
            gradeId,
            studentId: params.studentId,
            gradeItemId: params.gradeItemId,
            overrideLabel: params.overrideLabel,
          })
        } else {
          await window.electronAPI.grade.deleteGradeOverride({
            gradeId,
            studentId: params.studentId,
            gradeItemId: params.gradeItemId,
          })
        }

        if (wasFrozen) {
          await window.electronAPI.grade.freezeGradeScores({
            gradeId,
            targets: [
              {
                studentId: params.studentId,
                gradeItemId: params.gradeItemId,
              },
            ],
            frozenByUserId: user?.id ?? null,
          })
          await calculate({ silent: true })
        }
      } catch (err) {
        console.error("Error persisting grade override:", err)
        // エラー時は再計算して整合性を回復
        calculate()
      }
    },
    [gradeId, result, calculate, user]
  )

  /**
   * 成績値を確定（凍結）する。targets 未指定なら Grade 全体を一括確定。
   * 既に確定済みのセルを含めれば、その時点のライブ値で確定し直す（再確定）。
   */
  const freezeScores = useCallback(
    async (targets?: GradeFrozenTarget[]) => {
      try {
        const response = await window.electronAPI.grade.freezeGradeScores({
          gradeId,
          targets,
          frozenByUserId: user?.id ?? null,
        })
        if (!response.success) {
          setError(response.error ?? "成績値の確定に失敗しました")
          return
        }
        await calculate({ silent: true })
      } catch (err) {
        console.error("Error freezing grade scores:", err)
        setError("成績値の確定中にエラーが発生しました")
      }
    },
    [gradeId, calculate, user]
  )

  /** 成績値の確定を解除する。targets 未指定なら Grade 全体を一括解除 */
  const unfreezeScores = useCallback(
    async (targets?: GradeFrozenTarget[]) => {
      try {
        const response = await window.electronAPI.grade.unfreezeGradeScores({
          gradeId,
          targets,
          userId: user?.id ?? null,
        })
        if (!response.success) {
          setError(response.error ?? "確定の解除に失敗しました")
          return
        }
        await calculate({ silent: true })
      } catch (err) {
        console.error("Error unfreezing grade scores:", err)
        setError("確定の解除中にエラーが発生しました")
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
