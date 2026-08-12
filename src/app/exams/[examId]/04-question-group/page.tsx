"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { QuestionAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/QuestionAssignmentMatrixWithFillHandle"
import { SubtotalAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/SubtotalAssignmentMatrixWithFillHandle"
import { SubtotalGroupSelector } from "@/components/exams/04-question-group/components/SubtotalGroupSelector"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { SubtotalGroupWithSubtotals } from "@/electron-src/lib/prisma/subtotalGroup"
import { queryKeys } from "@/lib/queryKeys"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_GROUPS: SubtotalGroupWithSubtotals[] = []
const EMPTY_REGIONS: CropRegionWithSubtotals[] = []

export default function SubtotalGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const queryClient = useQueryClient()
  const [mutationError, setMutationError] = useState<string | null>(null)

  // 設問・小計欄・小計点グループはマトリクスの行と列なので1つの取得にまとめる
  const {
    data,
    isPending: loading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.exam.cropRegions(examId),
    queryFn: examId
      ? async () => {
          const [cropRegions, examSubtotalGroups] = await Promise.all([
            window.electronAPI.getCropRegionsByExamId(examId),
            window.electronAPI.getActiveSubtotalGroupsForExam(examId),
          ])
          return {
            activeSubtotalGroups: examSubtotalGroups.map(
              (examSubtotalGroup) =>
                examSubtotalGroup.subtotalGroup as SubtotalGroupWithSubtotals
            ),
            cropRegions: cropRegions.filter(
              (cropRegion) => cropRegion.type === "QUESTION_ANSWER"
            ),
            subtotalRegions: cropRegions.filter(
              (cropRegion) => cropRegion.type === "SUBTOTAL_SCORE"
            ),
          }
        }
      : skipToken,
  })
  const activeSubtotalGroups = data?.activeSubtotalGroups ?? EMPTY_GROUPS
  const cropRegions = data?.cropRegions ?? EMPTY_REGIONS
  const subtotalRegions = data?.subtotalRegions ?? EMPTY_REGIONS
  const error = mutationError ?? queryError?.message ?? null

  const loadData = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.exam.cropRegions(examId),
      }),
    [queryClient, examId]
  )

  // 小計点とサブトータルの関連付け更新
  const updateSubtotalAssignments = useCallback(
    async (subtotalCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(
          subtotalCropRegionId
        )

        // 新しい関連付けを作成
        if (subtotalIds.length > 0) {
          const cropSubtotals = subtotalIds.map((subtotalId) => ({
            cropRegionId: subtotalCropRegionId,
            subtotalId,
            assignmentType: "SUBTOTAL_DEFINITION" as const,
          }))

          await window.electronAPI.createManyCropSubtotals(cropSubtotals)
        }

        return true
      } catch (err) {
        setMutationError(
          err instanceof Error
            ? err.message
            : "小計点関連付けの更新に失敗しました"
        )
        return false
      }
    },
    []
  )

  // 設問と小計項目の関連付け更新
  const updateQuestionAssignments = useCallback(
    async (questionCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(
          questionCropRegionId
        )

        // 新しい関連付けを作成
        if (subtotalIds.length > 0) {
          const cropSubtotals = subtotalIds.map((subtotalId) => ({
            cropRegionId: questionCropRegionId,
            subtotalId,
            assignmentType: "QUESTION_ASSIGNMENT" as const,
          }))

          await window.electronAPI.createManyCropSubtotals(cropSubtotals)
        }

        return true
      } catch (err) {
        setMutationError(
          err instanceof Error
            ? err.message
            : "設問関連付けの更新に失敗しました"
        )
        return false
      }
    },
    []
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
            <Button onClick={loadData} className="mt-4" variant="outline">
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
            onRefresh={loadData}
          />

          {/* 設問と小計項目の関連付け */}
          {activeSubtotalGroups.length > 0 && cropRegions.length > 0 && (
            <div className="rounded-lg border p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  設問と小計項目の関連付け
                </h2>
              </div>
              <QuestionAssignmentMatrixWithFillHandle
                subtotalGroups={activeSubtotalGroups}
                cropRegions={cropRegions}
                onUpdateAssignments={updateQuestionAssignments}
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
                subtotalGroups={activeSubtotalGroups}
                subtotalRegions={subtotalRegions}
                onUpdateSubtotalAssignments={updateSubtotalAssignments}
              />
            </div>
          )}

          {/* ガイダンス */}
          {cropRegions.length === 0 && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-sm text-yellow-800">
                まず「採点領域作成」で設問領域と小計点領域を作成してください。
              </p>
            </div>
          )}

          {subtotalRegions.length === 0 && cropRegions.length > 0 && (
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
