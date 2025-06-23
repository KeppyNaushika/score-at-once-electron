"use client"

import PageHeader from "@/components/layout/PageHeader"
import RegionDetailsTable from "@/components/project/layout/RegionDetailsTable"
import { Button } from "@/components/ui/button"
import { AreaType, MasterImage, Project, User } from "@prisma/client"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

export default function RegionInfoPage() {
  const params = useParams()
  const router = useRouter()

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
  const [layoutRegions, setLayoutRegions] = useState<
    {
      id?: string
      type: AreaType
      x: number
      y: number
      width: number
      height: number
      label: string
      points: string | null
      questionNumber: string
      masterImageId: string
    }[]
  >([])

  const [masterImages, setMasterImages] = useState<MasterImage[]>([])
  const [selectedMasterImage, setSelectedMasterImage] =
    useState<MasterImage | null>(null)
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    null,
  )
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
          const url = await window.electronAPI.resolveFileProtocolPath(
            sortedMasterImages[0].path,
          )
          setBackgroundImageUrl(url)
          const img = new Image()
          img.onload = () => {
            setImageDimensions({
              width: img.naturalWidth,
              height: img.naturalHeight,
            })
          }
          img.src = url
        } else {
          setMasterImages([])
          setSelectedMasterImage(null)
          setBackgroundImageUrl(null)
          setImageDimensions(null)
        }

        // 既存のレイアウト領域を取得
        try {
          const existingRegions =
            await window.electronAPI.getLayoutRegionsByProjectId(projectId)
          if (existingRegions && existingRegions.length > 0) {
            setLayoutId("existing")
            setLayoutRegions(
              existingRegions.map((region) => ({
                id: region.id,
                type: region.type,
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
                label: region.label || "",
                points: region.points ? String(region.points) : null,
                questionNumber: region.questionNumber || "",
                masterImageId: region.masterImageId || "",
              })),
            )
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
        setBackgroundImageUrl(null)
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
    async (regions: any[]) => {
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
            points: area.points ? parseInt(area.points) : null,
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
            savedRegions
              .filter((region) => region !== null)
              .map((region) => ({
                id: region!.id,
                type: region!.type,
                x: region!.x,
                y: region!.y,
                width: region!.width,
                height: region!.height,
                label: region!.label || "",
                points: region!.points ? String(region!.points) : null,
                questionNumber: region!.questionNumber || "",
                masterImageId: region!.masterImageId || "",
              })),
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
    (newRegions: any[] | ((prev: any[]) => any[])) => {
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
        description="作成した採点領域に詳細な情報を設定します。各領域の種類、配点、ラベルなどを正確に入力してください。"
      >
        <Button
          onClick={() => router.push(`/projects/${projectId}/04-students`)}
        >
          次へ: 受験生徒管理
        </Button>
      </PageHeader>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Compact Image Preview */}
        <div
          className="border-r p-4"
          style={{ width: "400px", maxWidth: "33.333%" }}
        >
          <h3 className="mb-3 font-medium">模範解答</h3>
          {backgroundImageUrl && (
            <div className="relative overflow-hidden rounded-lg border">
              <img
                src={backgroundImageUrl}
                alt="模範解答"
                className="w-full object-contain"
              />
              {/* Overlay regions */}
              {layoutRegions.map((area, index) => {
                const isSelected = selectedRowIndex === index
                return (
                  <div
                    key={area.id || `area-${index}`}
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
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Right: Region Details Table */}
        <div className="flex-1 overflow-y-auto">
          <RegionDetailsTable
            regions={layoutRegions}
            setRegions={handleRegionsChange}
            disabled={isSaving}
            selectedRowIndex={selectedRowIndex}
            setSelectedRowIndex={setSelectedRowIndex}
          />
        </div>
      </div>
    </div>
  )
}
