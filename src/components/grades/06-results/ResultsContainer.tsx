"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import {
  ArrowRight,
  Lock,
  LockOpen,
  RefreshCw,
  TriangleAlert,
} from "lucide-react"
import Link from "next/link"
import { useMemo, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import {
  deleteGradeOverrideMutation,
  freezeGradeScoresMutation,
  gradeConstraintsQuery,
  gradeResultsQuery,
  unfreezeGradeScoresMutation,
  upsertGradeOverrideMutation,
} from "@/queries/grade"
import type {
  GradeCellTarget,
  GradeConstraintData,
  GradeOverrideInput,
} from "@/types/grade.types"

import { GradeDistributionChart } from "./GradeDistributionChart"
import { ResultsTable } from "./ResultsTable"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_CONSTRAINTS: GradeConstraintData[] = []

interface ResultsContainerProps {
  gradeId: string
}

export function ResultsContainer({ gradeId }: ResultsContainerProps) {
  const currentUser = useCurrentUser()
  const {
    data: result = null,
    isPending: loading,
    error: queryError,
    refetch,
  } = useQuery(gradeResultsQuery(gradeId))
  const { data: constraints = EMPTY_CONSTRAINTS } = useQuery(
    gradeConstraintsQuery(gradeId)
  )
  const upsertOverride = useMutation(upsertGradeOverrideMutation(gradeId))
  const deleteOverride = useMutation(deleteGradeOverrideMutation(gradeId))
  const freezeScores = useMutation(freezeGradeScoresMutation(gradeId))
  const unfreezeScores = useMutation(unfreezeGradeScoresMutation(gradeId))

  const recalculate = () => {
    void refetch()
  }

  /**
   * 評定の上書きを変える。
   *
   * 確定済みのセルは確定値が最優先なので、上書きを保存しただけでは表示が動かない。
   * 調整の結果をその場で取り込み直す（＝そのセルだけ再確定する）必要がある。
   * 2つの実体（上書き・確定値）への2つの操作であり、片方だけ済んでも意味は通る。
   */
  const setGradeOverride = async (params: GradeOverrideInput) => {
    const wasFrozen = Boolean(
      result?.students
        .find((student) => student.gradeStudentId === params.gradeStudentId)
        ?.gradeItemResults.find(
          (gradeItemResult) =>
            gradeItemResult.gradeItemId === params.gradeItemId
        )?.frozen
    )

    if (params.overrideLabel) {
      await upsertOverride.mutateAsync({
        ...params,
        overrideLabel: params.overrideLabel,
      })
    } else {
      await deleteOverride.mutateAsync({
        gradeStudentId: params.gradeStudentId,
        gradeItemId: params.gradeItemId,
      })
    }

    if (wasFrozen) {
      await freezeScores.mutateAsync({
        targets: [
          {
            gradeStudentId: params.gradeStudentId,
            gradeItemId: params.gradeItemId,
          },
        ],
        frozenByUserId: currentUser.id,
      })
    }
  }

  const error = queryError?.message ?? null
  // 一括操作の確認。どちらも確定済みの値を捨てるので、確定値がある間は必ず挟む。
  const [pendingBulkAction, setPendingBulkAction] = useState<
    "refreeze" | "unfreeze" | null
  >(null)

  // 確定の集計。除外セルは値を持たず確定対象外なので母数から外す。
  const frozenSummary = useMemo(() => {
    let freezable = 0
    let frozen = 0
    let stale = 0
    for (const student of result?.students ?? []) {
      for (const gradeItemResult of student.gradeItemResults) {
        if (gradeItemResult.isExcluded) continue
        freezable++
        if (!gradeItemResult.frozen) continue
        frozen++
        if (gradeItemResult.frozen.isStale) stale++
      }
    }
    return { freezable, frozen, stale }
  }, [result])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">成績を計算中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="mb-2 text-destructive">{error}</p>
        <Button variant="outline" onClick={recalculate}>
          <RefreshCw className="mr-2 h-4 w-4" />
          再計算
        </Button>
      </div>
    )
  }

  if (!result) return null

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            成績結果: {result.gradeName}
          </h2>
          <p className="text-sm text-muted-foreground">
            {result.classNames.join("、") || "学級未登録"} /{" "}
            {result.gradeItems.map((gradeItem) => gradeItem.name).join("、") ||
              "評価項目未設定"}{" "}
            / {result.students.length}名
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={recalculate}>
            <RefreshCw className="mr-2 h-4 w-4" />
            再計算
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              frozenSummary.frozen === 0
                ? freezeScores.mutate({ frozenByUserId: currentUser.id })
                : setPendingBulkAction("refreeze")
            }
          >
            <Lock className="mr-2 h-4 w-4" />
            {frozenSummary.frozen === 0
              ? "成績を確定"
              : "すべて現在の値で再確定"}
          </Button>
          {frozenSummary.frozen > 0 && (
            <Button
              variant="outline"
              onClick={() => setPendingBulkAction("unfreeze")}
            >
              <LockOpen className="mr-2 h-4 w-4" />
              確定をすべて解除
            </Button>
          )}
          <Button asChild>
            <Link href={`/grades/${gradeId}/07-export`}>
              出力へ進む
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {frozenSummary.frozen > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            {frozenSummary.frozen} / {frozenSummary.freezable} 件を確定済み
          </span>
          {frozenSummary.stale > 0 && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5" />
              うち {frozenSummary.stale}{" "}
              件は確定後に元データが変わっています（表示は確定値のまま固定）
            </span>
          )}
        </div>
      )}

      <GradeDistributionChart result={result} />
      <ResultsTable
        result={result}
        constraints={constraints}
        onGradeOverride={setGradeOverride}
        onRefreezeCell={(target: GradeCellTarget) =>
          freezeScores.mutate({
            targets: [target],
            frozenByUserId: currentUser.id,
          })
        }
        onUnfreezeCell={(target: GradeCellTarget) =>
          unfreezeScores.mutate({ targets: [target], userId: currentUser.id })
        }
      />

      <AlertDialog
        open={pendingBulkAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBulkAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingBulkAction === "refreeze"
                ? "すべて現在の値で確定し直しますか？"
                : "確定をすべて解除しますか？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingBulkAction === "refreeze"
                ? `確定済みの ${frozenSummary.frozen} 件を含め、すべての成績値を現在のリアルタイム算出値で確定し直します。現在の確定値は復元できません。`
                : `確定済みの ${frozenSummary.frozen} 件の成績値を破棄し、すべてリアルタイム算出値に戻します。確定時点の値は復元できません。`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const action = pendingBulkAction
                setPendingBulkAction(null)
                if (action === "refreeze")
                  freezeScores.mutate({ frozenByUserId: currentUser.id })
                else if (action === "unfreeze")
                  unfreezeScores.mutate({ userId: currentUser.id })
              }}
            >
              {pendingBulkAction === "refreeze" ? "すべて再確定" : "すべて解除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
