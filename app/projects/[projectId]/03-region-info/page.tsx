"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import RegionDetailsTable from "@/components/projects/03-region-info/RegionDetailsTable"
import { Button } from "@/components/ui/button"
// AreaType enum は削除されたため、文字列型として定義
type AreaType = "QUESTION_ANSWER" | "STUDENT_NAME" | "STUDENT_ID" | "TOTAL_SCORE" | "SUBTOTAL_SCORE" | "MARK" | "COMMENT" | "OTHER"
import { MasterImage, Project, User } from "@prisma/client"
import type { LayoutRegionWithDetails } from "@/types/electron"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export default function RegionInfoPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()

  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(
    null,
  )
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [layoutId, setLayoutId] = useState<string | undefined>(undefined)
  const [layoutRegions, setLayoutRegions] = useState<LayoutRegionWithDetails[]>([])

  const [masterImages, setMasterImages] = useState<MasterImage[]>([])
  const [selectedMasterImage, setSelectedMasterImage] =
    useState<MasterImage | null>(null)
  const [backgroundImageUrls, setBackgroundImageUrls] = useState<{[key: string]: string}>({})
  const [imageDimensions, setImageDimensions] = useState<{
    width: number
    height: number
  } | null>(null)

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const loadInitialData = useCallback(async () => {
    if (!projectId) {
      toast.error("プロジェクトIDが見つかりません。")
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const user = await window.electronAPI.getCurrentUser()
      setCurrentUser(user)

      const fetchedProject =
        await window.electronAPI.fetchProjectById(projectId)
      if (fetchedProject) {
        setProject(fetchedProject)
        if (
          fetchedProject.masterImages &&
          fetchedProject.masterImages.length > 0
        ) {
          const sortedMasterImages = [...fetchedProject.masterImages].sort(
            (a, b) => a.pageNumber - b.pageNumber,
          )
          setMasterImages(sortedMasterImages)
          setSelectedMasterImage(sortedMasterImages[0])
          
          // 全ページの画像URLを取得
          const urls: {[key: string]: string} = {}
          for (const image of sortedMasterImages) {
            const url = await window.electronAPI.resolveFileProtocolPath(image.path)
            urls[image.id] = url
          }
          setBackgroundImageUrls(urls)
          
          // 最初のページの寸法を取得
          const firstUrl = urls[sortedMasterImages[0].id]
          const img = new Image()
          img.onload = () => {
            setImageDimensions({
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          }
          img.src = firstUrl
        } else {
          setMasterImages([])
          setSelectedMasterImage(null)
          setBackgroundImageUrls({})
          setImageDimensions(null)
        }

        // 既存のレイアウト領域を取得
        try {
          const existingRegions =
            await window.electronAPI.getLayoutRegionsByProjectId(projectId)
          if (existingRegions && existingRegions.length > 0) {
            setLayoutId("existing")
            setLayoutRegions(existingRegions)
          } else {
            setLayoutId(undefined)
            setLayoutRegions([])
          }
        } catch (regionError) {
          console.error("Failed to load layout regions:", regionError)
          setLayoutId(undefined)
          setLayoutRegions([])
        }
      } else {
        toast.error("プロジェクトが見つかりません。")
        setProject(null)
        setMasterImages([])
        setSelectedMasterImage(null)
        setBackgroundImageUrls({})
        setImageDimensions(null)
        setLayoutRegions([])
      }
    } catch (error) {
      console.error("Failed to load initial data:", error)
      toast.error("初期データの読み込みに失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadInitialData()
  }, [loadInitialData])

  const autoSaveRegions = useCallback(
    async (regions: LayoutRegionWithDetails[]) => {
      if (!projectId || !currentUser) return

      try {
        const savePromises = regions.map(async (area) => {
          if (!area.masterImageId) return null

          const regionData = {
            projectId,
            masterImageId: area.masterImageId,
            type: area.type,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            label: area.label,
            points: area.points,
            questionNumber: area.questionNumber,
          }

          if (area.id) {
            return await window.electronAPI.updateLayoutRegion(
              area.id,
              regionData,
            )
          } else {
            return await window.electronAPI.createLayoutRegion(regionData)
          }
        })

        const savedRegions = await Promise.all(savePromises.filter(Boolean))

        if (savedRegions.length > 0) {
          setLayoutRegions(
            savedRegions.filter((region): region is LayoutRegionWithDetails => region !== null)
          )
          setLayoutId("saved")
        }
      } catch (error) {
        console.error("Auto-save failed:", error)
      }
    },
    [projectId, currentUser],
  )

  const handleRegionsChange = useCallback(
    (newRegions: LayoutRegionWithDetails[] | ((prev: LayoutRegionWithDetails[]) => LayoutRegionWithDetails[])) => {
      const updatedRegions =
        typeof newRegions === "function"
          ? newRegions(layoutRegions)
          : newRegions

      setLayoutRegions(updatedRegions)

      // Clear existing timeout
      if (saveTimeoutId) {
        clearTimeout(saveTimeoutId)
      }

      // Set new timeout for auto-save
      const timeoutId = setTimeout(() => {
        autoSaveRegions(updatedRegions)
      }, 1000) // Auto-save after 1 second of inactivity

      setSaveTimeoutId(timeoutId)
    },
    [saveTimeoutId, autoSaveRegions, layoutRegions],
  )

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>領域情報を読み込み中...</p>
      </div>
    )
  }
  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>プロジェクト情報がありません。</p>
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <PageHeader
        title="領域情報の編集"
        description=""
        helpButton={helpButton}
      >
        <Button
          onClick={() => router.push(`/projects/${projectId}/04-students`)}
        >
          次へ: 受験生徒管理
        </Button>
      </PageHeader>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: All Pages Preview */}
        <div
          className="border-r p-4 overflow-y-auto"
          style={{ width: "400px", maxWidth: "33.333%" }}
        >
          <h3 className="mb-3 font-medium">模範解答 (全ページ)</h3>
          <div className="space-y-4">
            {masterImages.map((_, pageIndex) => {
              // 順序は固定（1, 2, 3...）だが、対応する画像は実際のpageNumber順
              const displayPageNumber = pageIndex + 1
              const correspondingImage = masterImages.find(img => img.pageNumber === displayPageNumber)
              
              if (!correspondingImage) {
                return (
                  <div key={`page-${displayPageNumber}`} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">ページ {displayPageNumber}</h4>
                      <div className="text-xs text-muted-foreground">
                        (画像なし)
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-lg border bg-gray-100 aspect-[3/4] flex items-center justify-center">
                      <div className="text-muted-foreground text-sm">画像が見つかりません</div>
                    </div>
                  </div>
                )
              }

              const imageUrl = backgroundImageUrls[correspondingImage.id]
              const pageRegions = layoutRegions.filter(region => region.masterImageId === correspondingImage.id)
              
              return (
                <div key={`page-${displayPageNumber}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">ページ {displayPageNumber}</h4>
                    <div className="text-xs text-muted-foreground">
                      ({pageRegions.length}個の領域)
                    </div>
                  </div>
                  {imageUrl && (
                    <div className="relative overflow-hidden rounded-lg border">
                      <img
                        src={imageUrl}
                        alt={`模範解答 ページ ${displayPageNumber}`}
                        className="w-full object-contain cursor-pointer hover:opacity-75 transition-opacity"
                        onClick={() => {
                          setSelectedMasterImage(correspondingImage)
                          // 画像寸法を更新
                          const img = new Image()
                          img.onload = () => {
                            setImageDimensions({
                              width: img.naturalWidth,
                              height: img.naturalHeight,
                            })
                          }
                          img.src = imageUrl
                        }}
                      />
                      {/* Overlay regions for this page */}
                      {pageRegions.map((area, index) => {
                        const globalIndex = layoutRegions.findIndex(r => r.id === area.id)
                        const isSelected = selectedRowIndex === globalIndex
                        return (
                          <div
                            key={area.id || `area-${pageIndex}-${index}`}
                            className={`absolute border-2 ${
                              isSelected
                                ? "border-orange-500 bg-orange-500/30"
                                : "border-blue-500 bg-blue-500/20"
                            }`}
                            style={{
                              left: `${area.x * 100}%`,
                              top: `${area.y * 100}%`,
                              width: `${area.width * 100}%`,
                              height: `${area.height * 100}%`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedRowIndex(globalIndex)
                            }}
                          />
                        )
                      })}
                      {/* Page indicator if this is selected */}
                      {selectedMasterImage?.id === correspondingImage.id && (
                        <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
                          編集中
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Region Details Table */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium">領域情報テーブル（全ページ統一順序）</h3>
              <p className="text-sm text-muted-foreground">
                全ページ {layoutRegions.length}個の領域を統一順序で表示
                {selectedMasterImage && (
                  <span className="ml-2 text-blue-600">
                    ※ ページ {selectedMasterImage.pageNumber} を選択中
                  </span>
                )}
              </p>
            </div>
            <RegionDetailsTable
              regions={layoutRegions}
              setRegions={handleRegionsChange}
              disabled={isSaving}
              selectedRowIndex={selectedRowIndex}
              setSelectedRowIndex={setSelectedRowIndex}
              selectedMasterImageId={selectedMasterImage?.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
