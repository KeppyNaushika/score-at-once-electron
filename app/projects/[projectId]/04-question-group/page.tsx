"use client"

import LoadingSpinner from "@/components/common/LoadingSpinner"
import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import { SubtotalGroupSelector } from "@/components/projects/04-question-group/components/SubtotalGroupSelector"
import { SubtotalAssignmentMatrix } from "@/components/projects/04-question-group/components/SubtotalAssignmentMatrix"
import { QuestionAssignmentMatrix } from "@/components/projects/04-question-group/components/QuestionAssignmentMatrix"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, Settings, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { CropRegionWithDetails, SubtotalGroupWithItems } from "@/types/electron"

export default function SubtotalGroupPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()
  const projectId = params.projectId as string

  const [project, setProject] = useState<any>(null)
  const [activeSubtotalGroups, setActiveSubtotalGroups] = useState<SubtotalGroupWithItems[]>([])
  const [availableSubtotalGroups, setAvailableSubtotalGroups] = useState<SubtotalGroupWithItems[]>([])
  const [cropRegions, setCropRegions] = useState<CropRegionWithDetails[]>([])
  const [subtotalRegions, setSubtotalRegions] = useState<CropRegionWithDetails[]>([])
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
      const [activeSubtotalGroupsResponse, availableSubtotalGroupsResponse] = await Promise.all([
        window.electronAPI.getActiveSubtotalGroupsForProject(projectId),
        window.electronAPI.getAvailableSubtotalGroupsForProject(projectId),
      ])

      if (projectResponse) {
        setProject(projectResponse)
      }

      if (activeSubtotalGroupsResponse && activeSubtotalGroupsResponse.success) {
        const activeGroups = activeSubtotalGroupsResponse.projectSubtotalGroups?.map(
          (psg: any) => psg.subtotalGroup
        ) || []
        setActiveSubtotalGroups(activeGroups)
      }

      if (availableSubtotalGroupsResponse && availableSubtotalGroupsResponse.success) {
        setAvailableSubtotalGroups(availableSubtotalGroupsResponse.subtotalGroups || [])
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
      <div className="container mx-auto space-y-6 px-4 py-6">
        <div className="flex items-center justify-center">
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
    <div className="container mx-auto space-y-6 px-4 py-6">
      <PageHeader
        title="小計点設定"
        description="事前に作成した小計点グループをプロジェクトに適用し、小計点領域との関連付けを設定します。"
        helpButton={helpButton}
      />

      <div className="grid grid-cols-1 gap-6">
        {/* 小計点グループ管理への案内 */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Settings className="h-5 w-5" />
              小計点グループの作成・管理
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-blue-700 text-sm mb-4">
              新しい小計点グループの作成や既存グループの編集は、専用の管理ページで行います。
            </p>
            <Link href="/subtotal-groups">
              <Button variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100">
                <ExternalLink className="mr-2 h-4 w-4" />
                小計点グループ管理ページを開く
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* 小計点グループ選択 */}
        <SubtotalGroupSelector
          projectId={projectId}
          activeSubtotalGroups={activeSubtotalGroups}
          onRefresh={loadData}
        />

        {/* 適用済み小計点グループの表示 */}
        {activeSubtotalGroups.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                適用済み小計点グループ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeSubtotalGroups.map((group) => (
                  <div key={group.id} className="p-4 border rounded-lg">
                    <h3 className="font-medium text-lg mb-2">{group.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {group.subtotals?.map((subtotal) => (
                        <div key={subtotal.id} className="text-sm bg-gray-100 px-3 py-1 rounded">
                          {subtotal.name}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 設問と小計項目の関連付け */}
        {activeSubtotalGroups.length > 0 && cropRegions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                設問と小計項目の関連付け
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuestionAssignmentMatrix
                subtotalGroups={activeSubtotalGroups}
                cropRegions={cropRegions}
                onUpdateAssignments={updateQuestionAssignments}
              />
            </CardContent>
          </Card>
        )}

        {/* 小計点領域との関連付け */}
        {activeSubtotalGroups.length > 0 && subtotalRegions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                小計点領域との関連付け
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SubtotalAssignmentMatrix
                subtotalGroups={activeSubtotalGroups}
                subtotalRegions={subtotalRegions}
                onUpdateSubtotalAssignments={updateSubtotalAssignments}
              />
            </CardContent>
          </Card>
        )}

        {/* ガイダンス */}
        {cropRegions.length === 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-yellow-800 text-sm">
                まず「採点領域作成」で設問領域と小計点領域を作成してください。
              </p>
            </CardContent>
          </Card>
        )}

        {subtotalRegions.length === 0 && cropRegions.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <p className="text-yellow-800 text-sm">
                小計点領域が作成されていません。「採点領域作成」で小計点領域を追加してください。
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* フッター */}
      <div className="flex justify-center">
        <Button
          onClick={() => router.push(`/projects/${projectId}/05-students`)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          次のステップ: 受験生徒管理
        </Button>
      </div>
    </div>
  )
}