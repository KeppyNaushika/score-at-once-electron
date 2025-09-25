"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { QuestionAssignmentMatrix } from "@/components/projects/04-question-group/components/QuestionAssignmentMatrix"
import { SubtotalAssignmentMatrix } from "@/components/projects/04-question-group/components/SubtotalAssignmentMatrix"
import { SubtotalGroupSelector } from "@/components/projects/04-question-group/components/SubtotalGroupSelector"
import { Button } from "@/components/ui/button"
import { CropRegionWithDetails, SubtotalGroupWithItems } from "@/types/electron"
import { Calculator } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

export default function SubtotalGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeSubtotalGroups, setActiveSubtotalGroups] = useState<
    SubtotalGroupWithItems[]
  >([])
  const [availableSubtotalGroups, setAvailableSubtotalGroups] = useState<
    SubtotalGroupWithItems[]
  >([])
  const [cropRegions, setCropRegions] = useState<CropRegionWithDetails[]>([])
  const [subtotalRegions, setSubtotalRegions] = useState<
    CropRegionWithDetails[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // データ読み込み
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // プロジェクト基本情報とCropRegionsのみ取得
      const [projectResponse, cropRegionsResponse] = await Promise.all([
        window.electronAPI.fetchProjectById(projectId),
        window.electronAPI.getCropRegionsByProjectId(projectId),
      ])

      // 小計点グループの取得
      const [activeSubtotalGroupsResponse, availableSubtotalGroupsResponse] =
        await Promise.all([
          window.electronAPI.getActiveSubtotalGroupsForProject(projectId),
          window.electronAPI.getAvailableSubtotalGroupsForProject(projectId),
        ])

      if (projectResponse) {
        setProject(projectResponse)
      }

      if (
        activeSubtotalGroupsResponse &&
        activeSubtotalGroupsResponse.success
      ) {
        const activeGroups =
          activeSubtotalGroupsResponse.projectSubtotalGroups?.map(
            (psg: any) => psg.subtotalGroup,
          ) || []
        setActiveSubtotalGroups(activeGroups)
      }

      if (
        availableSubtotalGroupsResponse &&
        availableSubtotalGroupsResponse.success
      ) {
        setAvailableSubtotalGroups(
          availableSubtotalGroupsResponse.subtotalGroups || [],
        )
      }

      if (cropRegionsResponse) {
        // 設問タイプの領域のみフィルタリング
        const questionRegions = cropRegionsResponse.filter(
          (region: CropRegionWithDetails) => region.type === "QUESTION_ANSWER",
        )
        setCropRegions(questionRegions)

        // 小計点タイプの領域のみフィルタリング
        const subtotalRegions = cropRegionsResponse.filter(
          (region: CropRegionWithDetails) => region.type === "SUBTOTAL_SCORE",
        )
        setSubtotalRegions(subtotalRegions)
      }
    } catch (err) {
      console.error("データの読み込みエラー:", err)
      setError(
        err instanceof Error ? err.message : "データの読み込みに失敗しました",
      )
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // 小計点とサブトータルの関連付け更新
  const updateSubtotalAssignments = useCallback(
    async (subtotalCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(
          subtotalCropRegionId,
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
        setError(
          err instanceof Error
            ? err.message
            : "小計点関連付けの更新に失敗しました",
        )
        return false
      }
    },
    [],
  )

  // 設問と小計項目の関連付け更新
  const updateQuestionAssignments = useCallback(
    async (questionCropRegionId: string, subtotalIds: string[]) => {
      try {
        // 既存の関連付けを削除
        await window.electronAPI.deleteCropSubtotalsByCropRegionId(
          questionCropRegionId,
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
        setError(
          err instanceof Error
            ? err.message
            : "設問関連付けの更新に失敗しました",
        )
        return false
      }
    },
    [],
  )

  // 初期化
  useEffect(() => {
    loadData()
  }, [loadData])

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
        <PageHeader
          title="小計点の設定"
          helpButton={helpButton}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-red-600">
              エラーが発生しました
            </h2>
            <p className="text-muted-foreground mt-2 text-sm">{error}</p>
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
      <PageHeader
        title="小計点の設定"
        helpButton={helpButton}
      >
        <Button
          onClick={() => router.push(`/projects/${projectId}/05-students`)}
        >
          次へ: 受験生徒の管理
        </Button>
      </PageHeader>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-8">
        {/* 小計点グループ選択 */}
        <SubtotalGroupSelector
          projectId={projectId}
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
            <QuestionAssignmentMatrix
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
              <h2 className="text-lg font-semibold">小計点領域との関連付け</h2>
            </div>
            <SubtotalAssignmentMatrix
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
