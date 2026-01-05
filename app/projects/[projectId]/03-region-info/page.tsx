"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import RegionDetailsTable from "@/components/projects/03-region-info/components/RegionDetailsTable"
import { Button } from "@/components/ui/button"
import type { CropRegionWithDetails } from "@/types/electron"
import { ProjectPage, User } from "@prisma/client"
import Image from "next/image"
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
    null
  )
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [cropRegions, setCropRegions] = useState<CropRegionWithDetails[]>([])

  const [projectPages, setProjectPages] = useState<ProjectPage[]>([])
  const [selectedProjectPage, setSelectedProjectPage] =
    useState<ProjectPage | null>(null)
  const [backgroundImageUrls, setBackgroundImageUrls] = useState<{
    [key: string]: string
  }>({})

  const [isLoading, setIsLoading] = useState(true)

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
        if (
          fetchedProject.projectPages &&
          fetchedProject.projectPages.length > 0
        ) {
          const sortedProjectPages = [...fetchedProject.projectPages].sort(
            (a, b) => a.pageNumber - b.pageNumber
          )
          setProjectPages(sortedProjectPages)
          setSelectedProjectPage(sortedProjectPages[0])

          // 全ページの画像URLを取得
          const urls: { [key: string]: string } = {}
          for (const page of sortedProjectPages) {
            const masterImage = page.masterImages?.[0]
            if (masterImage) {
              const url = await window.electronAPI.resolveFileProtocolPath(
                masterImage.imagePath
              )
              urls[page.id] = url
            }
          }
          setBackgroundImageUrls(urls)
        } else {
          setProjectPages([])
          setSelectedProjectPage(null)
          setBackgroundImageUrls({})
        }

        // 既存の作物領域を取得
        try {
          const existingRegions =
            await window.electronAPI.getCropRegionsByProjectId(projectId)
          if (existingRegions && existingRegions.length > 0) {
            setCropRegions(existingRegions)
          } else {
            setCropRegions([])
          }
        } catch (regionError) {
          console.error("Failed to load crop regions:", regionError)
          setCropRegions([])
        }
      } else {
        toast.error("プロジェクトが見つかりません。")
        setProjectPages([])
        setSelectedProjectPage(null)
        setBackgroundImageUrls({})
        setCropRegions([])
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
    async (regions: CropRegionWithDetails[]) => {
      if (!projectId || !currentUser) return

      try {
        const savePromises = regions.map(async (area) => {
          if (!area.projectPage?.id) return null

          const regionData = {
            projectPageId: area.projectPage.id,
            type: area.type,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            label: area.label,
            points: area.points,
            orderIndex: area.orderIndex,
          }

          if (area.id) {
            return await window.electronAPI.updateCropRegion(
              area.id,
              regionData
            )
          } else {
            const { orderIndex: _ignoredOrderIndex, ...createData } = regionData
            return await window.electronAPI.createCropRegion(createData)
          }
        })

        const savedRegions = await Promise.all(savePromises.filter(Boolean))

        if (savedRegions.length > 0) {
          setCropRegions(
            savedRegions.filter(
              (
                region: CropRegionWithDetails | null
              ): region is CropRegionWithDetails => region !== null
            )
          )
        }
      } catch (error) {
        console.error("Auto-save failed:", error)
      }
    },
    [projectId, currentUser]
  )

  const handleRegionsChange = useCallback(
    (
      newRegions:
        | CropRegionWithDetails[]
        | ((prev: CropRegionWithDetails[]) => CropRegionWithDetails[])
    ) => {
      const updatedRegions =
        typeof newRegions === "function" ? newRegions(cropRegions) : newRegions

      setCropRegions(updatedRegions)

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
    [saveTimeoutId, autoSaveRegions, cropRegions]
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
      <PageHeader title="採点領域の詳細情報設定" helpButton={helpButton}>
        <Button
          onClick={() =>
            router.push(`/projects/${projectId}/04-question-group`)
          }
        >
          次へ: 小計点の設定
        </Button>
      </PageHeader>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: All Pages Preview */}
        <div
          className="overflow-y-auto border-r p-4"
          style={{ width: "400px", maxWidth: "33.333%" }}
        >
          <h3 className="mb-3 font-medium">模範解答 (全ページ)</h3>
          <div className="space-y-4">
            {projectPages.map((page) => {
              const displayPageNumber = page.pageNumber
              const imageUrl = backgroundImageUrls[page.id]
              const pageRegions = cropRegions.filter(
                (region) => region.projectPage?.id === page.id
              )

              return (
                <div key={page.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">
                      ページ {displayPageNumber}
                    </h4>
                    <div className="text-muted-foreground text-xs">
                      ({pageRegions.length}個の領域)
                    </div>
                  </div>

                  {imageUrl ? (
                    <div className="relative overflow-hidden rounded-lg border">
                      <Image
                        src={imageUrl}
                        alt={`模範解答 ページ ${displayPageNumber}`}
                        className="w-full cursor-pointer object-contain transition-opacity hover:opacity-75"
                        width={800}
                        height={600}
                        unoptimized
                        onClick={() => {
                          setSelectedProjectPage(page)
                        }}
                      />
                      {pageRegions.map((area, index) => {
                        const globalIndex = cropRegions.findIndex(
                          (r) => r.id === area.id
                        )
                        const isSelected = selectedRowIndex === globalIndex
                        return (
                          <div
                            key={area.id ?? `area-${page.id}-${index}`}
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
                      {selectedProjectPage?.id === page.id && (
                        <div className="absolute top-2 left-2 rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                          編集中
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative flex aspect-3/4 items-center justify-center overflow-hidden rounded-lg border bg-gray-100">
                      <div className="text-muted-foreground text-sm">
                        画像が見つかりません
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Region Details Table */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 p-4 pb-0">
            <div className="mb-4">
              <h3 className="text-lg font-medium">
                領域情報テーブル（全ページ統一順序）
              </h3>
              <p className="text-muted-foreground text-sm">
                全ページ {cropRegions.length}個の領域を統一順序で表示
                {selectedProjectPage && (
                  <span className="ml-2 text-blue-600">
                    ※ ページ {selectedProjectPage.pageNumber} を選択中
                  </span>
                )}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                各行をクリックして選択し、種類・ラベル・配点などを設定してください。ドラッグ&ドロップで順序を変更できます。
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            <RegionDetailsTable
              regions={cropRegions}
              setRegions={handleRegionsChange}
              selectedRowIndex={selectedRowIndex}
              setSelectedRowIndex={setSelectedRowIndex}
              selectedMasterImageId={selectedProjectPage?.id}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
