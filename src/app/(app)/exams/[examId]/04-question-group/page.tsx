"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useMemo } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { QuestionAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/QuestionAssignmentMatrixWithFillHandle"
import { SubtotalAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/SubtotalAssignmentMatrixWithFillHandle"
import { SubtotalGroupSelector } from "@/components/exams/04-question-group/components/SubtotalGroupSelector"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { type CropRegionRow, cropRegionsQuery } from "@/queries/cropRegion"
import {
  activeSubtotalGroupsQuery,
  type ExamSubtotalGroupRow,
} from "@/queries/subtotal"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_REGIONS: CropRegionRow[] = []
const EMPTY_EXAM_SUBTOTAL_GROUPS: ExamSubtotalGroupRow[] = []

export default function SubtotalGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const queryClient = useQueryClient()

  const {
    data: cropRegions = EMPTY_REGIONS,
    isPending: cropRegionsPending,
    error: cropRegionsError,
  } = useQuery(cropRegionsQuery(examId))
  const {
    data: examSubtotalGroups = EMPTY_EXAM_SUBTOTAL_GROUPS,
    isPending: subtotalGroupsPending,
    error: subtotalGroupsError,
  } = useQuery(activeSubtotalGroupsQuery(examId))

  const loading = cropRegionsPending || subtotalGroupsPending
  const error = (cropRegionsError ?? subtotalGroupsError)?.message ?? null

  // マトリクスの列は小計点グループ、行は採点領域。どちらも表示のたびに絞り込む
  const activeSubtotalGroups = useMemo(
    () =>
      examSubtotalGroups.map(
        (examSubtotalGroup) => examSubtotalGroup.subtotalGroup
      ),
    [examSubtotalGroups]
  )
  /** 設問領域（QUESTION_ANSWER）。設問割当マトリクスの行 */
  const questionRegions = useMemo(
    () =>
      cropRegions.filter((cropRegion) => cropRegion.type === "QUESTION_ANSWER"),
    [cropRegions]
  )
  /** 小計欄領域（SUBTOTAL_SCORE）。小計点割当マトリクスの行 */
  const subtotalRegions = useMemo(
    () =>
      cropRegions.filter((cropRegion) => cropRegion.type === "SUBTOTAL_SCORE"),
    [cropRegions]
  )

  const reload = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: cropRegionsQuery(examId).queryKey,
      }),
    [queryClient, examId]
  )

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="小計点の設定" helpButton={helpButton} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">
              エラーが発生しました
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button onClick={reload} className="mt-4" variant="outline">
              再読み込み
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="小計点の設定" helpButton={helpButton}>
        <Button onClick={() => router.push(`/exams/${examId}/05-students`)}>
          次へ: 受験生徒の管理
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-8">
          {/* 小計点グループ選択 */}
          <SubtotalGroupSelector
            examId={examId}
            activeSubtotalGroups={activeSubtotalGroups}
          />

          {/* 設問と小計項目の関連付け */}
          {activeSubtotalGroups.length > 0 && questionRegions.length > 0 && (
            <div className="rounded-lg border p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  設問と小計項目の関連付け
                </h2>
              </div>
              <QuestionAssignmentMatrixWithFillHandle
                examId={examId}
                subtotalGroups={activeSubtotalGroups}
                cropRegions={questionRegions}
                onReload={reload}
              />
            </div>
          )}

          {/* 小計点領域との関連付け */}
          {activeSubtotalGroups.length > 0 && subtotalRegions.length > 0 && (
            <div className="rounded-lg border p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  小計点領域との関連付け
                </h2>
              </div>
              <SubtotalAssignmentMatrixWithFillHandle
                examId={examId}
                subtotalGroups={activeSubtotalGroups}
                subtotalRegions={subtotalRegions}
                onReload={reload}
              />
            </div>
          )}

          {/* ガイダンス */}
          {questionRegions.length === 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-sm text-yellow-800">
                まず「採点領域作成」で設問領域と小計点領域を作成してください。
              </p>
            </div>
          )}

          {subtotalRegions.length === 0 && questionRegions.length > 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-sm text-yellow-800">
                小計点領域が作成されていません。「採点領域作成」で小計点領域を追加してください。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
