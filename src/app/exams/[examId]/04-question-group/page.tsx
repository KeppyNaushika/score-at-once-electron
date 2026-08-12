"use client"

import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query"
import { Calculator } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback } from "react"
import { toast } from "sonner"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { QuestionAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/QuestionAssignmentMatrixWithFillHandle"
import { SubtotalAssignmentMatrixWithFillHandle } from "@/components/exams/04-question-group/components/SubtotalAssignmentMatrixWithFillHandle"
import { SubtotalGroupSelector } from "@/components/exams/04-question-group/components/SubtotalGroupSelector"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import type { CropRegionWithSubtotals } from "@/electron-src/lib/prisma/cropRegion"
import type { CropSubtotalAssignmentType } from "@/electron-src/lib/prisma/cropSubtotal"
import type { SubtotalGroupWithSubtotals } from "@/electron-src/lib/prisma/subtotalGroup"
import { queryKeys } from "@/lib/queryKeys"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_GROUPS: SubtotalGroupWithSubtotals[] = []
const EMPTY_REGIONS: CropRegionWithSubtotals[] = []

/** この画面が1回の取得で揃える形 */
interface QuestionGroupPageData {
  activeSubtotalGroups: SubtotalGroupWithSubtotals[]
  /** 設問領域（QUESTION_ANSWER）。設問割当マトリクスの行 */
  questionRegions: CropRegionWithSubtotals[]
  /** 小計欄領域（SUBTOTAL_SCORE）。小計点割当マトリクスの行 */
  subtotalRegions: CropRegionWithSubtotals[]
}

/**
 * 1領域分の割り当てを差し替えたキャッシュを返す。
 *
 * 保存は「その領域の紐付けを全消しして作り直す」ので、キャッシュも同じ形に倒す。
 * ここで作る CropSubtotal の id は、取り直すまでの置き場所でしかない
 * （DB へは書かれない。表示は subtotalId しか読まない）。
 */
function withReplacedAssignments(
  previous: QuestionGroupPageData,
  cropRegionId: string,
  subtotalIds: string[],
  assignmentType: CropSubtotalAssignmentType
): QuestionGroupPageData {
  const subtotalById = new Map(
    previous.activeSubtotalGroups
      .flatMap((subtotalGroup) => subtotalGroup.subtotals)
      .map((subtotal) => [subtotal.id, subtotal])
  )
  const now = new Date()
  const cropSubtotals = subtotalIds.flatMap((subtotalId) => {
    const subtotal = subtotalById.get(subtotalId)
    if (!subtotal) return []
    return [
      {
        id: crypto.randomUUID(),
        cropRegionId,
        subtotalId,
        assignmentType,
        createdAt: now,
        updatedAt: now,
        subtotal,
      },
    ]
  })

  const replaceInRows = (cropRegions: CropRegionWithSubtotals[]) =>
    cropRegions.map((cropRegion) =>
      cropRegion.id === cropRegionId
        ? { ...cropRegion, cropSubtotals }
        : cropRegion
    )

  return {
    ...previous,
    questionRegions: replaceInRows(previous.questionRegions),
    subtotalRegions: replaceInRows(previous.subtotalRegions),
  }
}

export default function SubtotalGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const examId = typeof params.examId === "string" ? params.examId : ""

  const queryClient = useQueryClient()
  const queryKey = queryKeys.exam.questionGroupPage(examId)

  // 設問・小計欄・小計点グループはマトリクスの行と列なので1つの取得にまとめる
  const {
    data,
    isPending: loading,
    error: queryError,
  } = useQuery<QuestionGroupPageData>({
    queryKey,
    queryFn: examId
      ? async () => {
          const [cropRegions, examSubtotalGroups] = await Promise.all([
            window.electronAPI.getCropRegionsByExamId(examId),
            window.electronAPI.getActiveSubtotalGroupsForExam(examId),
          ])
          return {
            activeSubtotalGroups: examSubtotalGroups.map(
              (examSubtotalGroup) => examSubtotalGroup.subtotalGroup
            ),
            questionRegions: cropRegions.filter(
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
  const questionRegions = data?.questionRegions ?? EMPTY_REGIONS
  const subtotalRegions = data?.subtotalRegions ?? EMPTY_REGIONS
  const error = queryError?.message ?? null

  const loadData = useCallback(
    () => queryClient.invalidateQueries({ queryKey }),
    [queryClient, queryKey]
  )

  /**
   * 1領域分の割り当てを丸ごと差し替える。
   * 先にキャッシュを差し替え、失敗したら元へ戻して呼び出し元へ投げ返す。
   */
  const updateAssignments = useCallback(
    async (
      cropRegionId: string,
      subtotalIds: string[],
      assignmentType: CropSubtotalAssignmentType
    ) => {
      const previous = queryClient.getQueryData<QuestionGroupPageData>(queryKey)
      queryClient.setQueryData<QuestionGroupPageData>(queryKey, (cached) =>
        cached
          ? withReplacedAssignments(
              cached,
              cropRegionId,
              subtotalIds,
              assignmentType
            )
          : cached
      )

      try {
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(cropRegionId)
        if (subtotalIds.length > 0) {
          await window.electronAPI.createManyCropSubtotals(
            subtotalIds.map((subtotalId) => ({
              cropRegionId,
              subtotalId,
              assignmentType,
            }))
          )
        }
      } catch (err) {
        if (previous) queryClient.setQueryData(queryKey, previous)
        toast.error("関連付けの保存に失敗しました", {
          description: err instanceof Error ? err.message : undefined,
        })
        throw err
      }
    },
    [queryClient, queryKey]
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
          {activeSubtotalGroups.length > 0 && questionRegions.length > 0 && (
            <div className="rounded-lg border p-6">
              <div className="mb-4 flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                <h2 className="text-lg font-semibold">
                  設問と小計項目の関連付け
                </h2>
              </div>
              <QuestionAssignmentMatrixWithFillHandle
                subtotalGroups={activeSubtotalGroups}
                cropRegions={questionRegions}
                onUpdateAssignments={updateAssignments}
                onReload={loadData}
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
                onUpdateAssignments={updateAssignments}
                onReload={loadData}
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
