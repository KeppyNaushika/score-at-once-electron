"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
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
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  applyGradeBoundaryPresetMutation,
  deleteAllGradeItemBoundariesMutation,
  gradeDetailQuery,
  gradeResultsQuery,
} from "@/queries/grade"
import type {
  GradeItemWithDataSources,
  StudentGradeResult,
} from "@/types/grade.types"

import { collectUnknownGradeLabels } from "../gradeLabelValues"
import { BoundaryEditor } from "./BoundaryEditor"
import { BoundaryPresetSelector } from "./BoundaryPresetSelector"
import { ConstraintRulesEditor } from "./ConstraintRulesEditor"

interface BoundariesContainerProps {
  gradeId: string
}

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_GRADE_ITEMS: GradeItemWithDataSources[] = []
const EMPTY_STUDENTS: StudentGradeResult[] = []

export function BoundariesContainer({ gradeId }: BoundariesContainerProps) {
  const { data: grade, isPending: loading } = useQuery(
    gradeDetailQuery(gradeId)
  )
  /**
   * 上書きされた評定を見るために算出結果を読む。
   *
   * 結果（06）および同じ画面の制約ルール編集と同じキーなので、取得は共有される
   * （この画面はもともとこの結果を読んでいる）。上書きだけを返す口は無いが作る
   * 必要も無い ── 同じ結果を見ておけば、赤いマスと、ここの列挙が食い違わない。
   */
  const { data: result } = useQuery(gradeResultsQuery(gradeId))
  const applyPreset = useMutation(applyGradeBoundaryPresetMutation(gradeId))
  const deleteAllBoundaries = useMutation(
    deleteAllGradeItemBoundariesMutation(gradeId)
  )

  const [deletionTargetGradeItem, setDeletionTargetGradeItem] =
    useState<GradeItemWithDataSources | null>(null)

  /**
   * 評価項目 id → 上書きされたが基準に無い評定。
   *
   * **基準を決めるこの画面で気づく。** 上書きは自由に受け付けるので、基準に無い
   * 評定（校長判断の「／」など）も保存される。それが何であって何人分あるのかを、
   * 境界の編集欄のすぐ下に出す。基準へ足す導線は置かない（足すかどうかは人が決める）。
   * 集計は renderer 側で行う（main は算出結果の行を返すだけ）。
   */
  const unknownGradeLabelsByGradeItem = useMemo(() => {
    const gradeItems = grade?.gradeItems ?? EMPTY_GRADE_ITEMS
    const students = result?.students ?? EMPTY_STUDENTS
    return new Map(
      gradeItems.map((gradeItem) => [
        gradeItem.id,
        collectUnknownGradeLabels(gradeItem, students),
      ])
    )
  }, [grade?.gradeItems, result?.students])

  if (loading || !grade) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  const gradeItems = grade.gradeItems

  return (
    <div className="p-6">
      <h2 className="mb-4 text-lg font-semibold">成績境界設定</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        各パーセンテージ閾値以上でその成績ラベルが付与されます。
      </p>

      <div className="space-y-4">
        {gradeItems.map((gradeItem) => {
          const unknownGradeLabels = unknownGradeLabelsByGradeItem.get(
            gradeItem.id
          )
          return (
            <Card key={gradeItem.id} className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">{gradeItem.name}</h3>
                {gradeItem.boundaries.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDeletionTargetGradeItem(gradeItem)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    境界設定を削除
                  </Button>
                )}
              </div>
              <BoundaryPresetSelector
                onSelect={(boundaries) =>
                  applyPreset.mutate({ gradeItemId: gradeItem.id, boundaries })
                }
              />
              <BoundaryEditor gradeId={gradeId} gradeItem={gradeItem} />
              {unknownGradeLabels !== undefined &&
                unknownGradeLabels.count > 0 && (
                  <p className="text-xs text-amber-700">
                    基準にない評定が入力されています:{" "}
                    {unknownGradeLabels.values.join("、")}（
                    {unknownGradeLabels.count}件）
                  </p>
                )}
            </Card>
          )
        })}
      </div>

      <Separator className="my-8" />

      <ConstraintRulesEditor gradeId={gradeId} gradeItems={gradeItems} />

      <div className="mt-8 flex justify-end">
        <Button asChild>
          <Link href={`/grades/${gradeId}/06-results`}>次へ: 結果</Link>
        </Button>
      </div>

      <AlertDialog
        open={deletionTargetGradeItem !== null}
        onOpenChange={(open) => {
          if (!open) setDeletionTargetGradeItem(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              「{deletionTargetGradeItem?.name}
              」の成績境界を削除しますか？
            </AlertDialogTitle>
            <AlertDialogDescription>
              この評価項目には成績ラベルが付かなくなり、結果画面と出力のラベル欄が空になります。確定済みの成績値に記録されたラベルはそのまま残ります。制約ルールが選べるラベルからもこの評価項目のラベルが外れるため、そのラベルを使っているルールは設定し直してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletionTargetGradeItem) {
                  deleteAllBoundaries.mutate(deletionTargetGradeItem.id)
                  setDeletionTargetGradeItem(null)
                }
              }}
            >
              削除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
