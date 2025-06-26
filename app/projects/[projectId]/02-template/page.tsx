"use client"

import { usePageHelp } from "@/components/help/usePageHelp"
import PageHeader from "@/components/layout/PageHeader"
import LayoutRegionEditor from "@/components/project/layout/LayoutRegionEditor"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { AreaType, MasterImage, Project, User } from "@prisma/client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()
  const { helpButton } = usePageHelp()

  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

  const [saveTimeoutId, setSaveTimeoutId] = useState<NodeJS.Timeout | null>(
    null,
  )
  const isSavingRef = useRef(false)
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
  const [isDetecting, setIsDetecting] = useState(false)

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
          console.log("loadInitialData - existingRegions:", existingRegions)

          const firstMasterImageId =
            fetchedProject.masterImages &&
            fetchedProject.masterImages.length > 0
              ? [...fetchedProject.masterImages].sort(
                  (a, b) => a.pageNumber - b.pageNumber,
                )[0].id
              : null
          console.log(
            "loadInitialData - firstMasterImageId:",
            firstMasterImageId,
          )

          if (existingRegions && existingRegions.length > 0) {
            setLayoutId("existing")
            // 最初のマスター画像に対応する領域のみをフィルター（sortedMasterImagesが定義された後）
            const currentImageRegions = firstMasterImageId
              ? existingRegions.filter(
                  (region) => region.masterImageId === firstMasterImageId,
                )
              : []
            console.log(
              "loadInitialData - currentImageRegions:",
              currentImageRegions,
            )

            const mappedRegions = currentImageRegions.map((region) => ({
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
            }))
            console.log("loadInitialData - mappedRegions:", mappedRegions)
            setLayoutRegions(mappedRegions)
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

  const handleMasterImageChange = async (imageId: string) => {
    const image = masterImages.find((img) => img.id === imageId)
    if (image) {
      // 現在の領域を保存
      if (layoutRegions.length > 0 && selectedMasterImage) {
        await autoSaveRegions(layoutRegions)
      }

      setSelectedMasterImage(image)
      try {
        const url = await window.electronAPI.resolveFileProtocolPath(image.path)
        setBackgroundImageUrl(url)
        const img = new Image()
        img.onload = () => {
          setImageDimensions({
            width: img.naturalWidth,
            height: img.naturalHeight,
          })
        }
        img.src = url

        // 新しいページの領域を読み込む
        if (projectId) {
          const allRegions =
            await window.electronAPI.getLayoutRegionsByProjectId(projectId)
          const currentImageRegions = allRegions.filter(
            (region) => region.masterImageId === image.id,
          )

          if (currentImageRegions.length > 0) {
            setLayoutRegions(
              currentImageRegions.map((region) => ({
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
            setLayoutRegions([])
          }
        }
      } catch (error) {
        toast.error("背景画像の読み込みに失敗しました。")
        setBackgroundImageUrl(null)
        setImageDimensions(null)
      }
    }
  }

  const autoSaveRegions = useCallback(
    async (regions: any[]) => {
      if (!projectId || !currentUser || isSavingRef.current) return

      isSavingRef.current = true
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
          setLayoutId("saved")
        }
      } catch (error) {
        console.error("Auto-save failed:", error)
      } finally {
        isSavingRef.current = false
      }
    },
    [projectId, currentUser],
  )

  const handleRegionsChange = useCallback(
    (newRegions: any[] | ((prev: any[]) => any[])) => {
      setLayoutRegions((prevRegions) => {
        const finalRegions =
          typeof newRegions === "function"
            ? newRegions(prevRegions)
            : newRegions

        // Auto-save logic with timeout
        setSaveTimeoutId((currentTimeoutId) => {
          if (currentTimeoutId) {
            clearTimeout(currentTimeoutId)
          }

          return setTimeout(() => {
            autoSaveRegions(finalRegions)
          }, 1000)
        })

        return finalRegions
      })
    },
    [autoSaveRegions],
  )

  const handleSaveTemplate = async () => {
    if (!projectId || !currentUser || !selectedMasterImage) {
      toast.error("プロジェクトID、ユーザー情報、基準画像は必須です。")
      return
    }

    setIsSaving(true)

    try {
      // 既存の領域を更新または新規作成
      const savePromises = layoutRegions.map(async (area) => {
        if (!area.masterImageId) {
          throw new Error(
            `Layout region ${area.label || "Unnamed"} is missing masterImageId.`,
          )
        }

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
          // 既存の領域を更新
          return await window.electronAPI.updateLayoutRegion(
            area.id,
            regionData,
          )
        } else {
          // 新しい領域を作成
          return await window.electronAPI.createLayoutRegion(regionData)
        }
      })

      const savedRegions = await Promise.all(savePromises)

      // 保存された領域でUIを更新
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

      if (savedRegions.length > 0) {
        setLayoutId("saved") // レイアウトが保存されたことを示すフラグ
      }

      toast.success(`採点枠を保存しました。`)
    } catch (error) {
      console.error("Failed to save layout:", error)
      toast.error("採点枠の保存に失敗しました。")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDetectLayoutRegions = async () => {
    if (!selectedMasterImage || !selectedMasterImage.path) {
      toast.error(
        "模範解答画像が選択されていないか、パスが無効です。自動検出を実行できません。",
      )
      return
    }
    setIsDetecting(true)
    try {
      // 自動検出機能は将来実装予定
      toast.info("自動検出機能は現在開発中です。手動で領域を設定してください。")
    } catch (error) {
      console.error("Failed to detect layout regions:", error)
      toast.error(
        `採点枠領域の自動検出に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
      )
    } finally {
      setIsDetecting(false)
    }
  }

  const goToNextStep = () => {
    if (!layoutId) {
      toast.error("採点枠が保存されていません。まず採点枠を保存してください。")
      return
    }
    router.push(`/projects/${projectId}/03-region-info`)
  }
  const goToPreviousStep = () => {
    router.push(`/projects/${projectId}/01-upload`)
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>採点枠情報を読み込み中...</p>
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
    <div className="flex h-full flex-col">
      <PageHeader title="採点領域の作成" description="" helpButton={helpButton}>
        {selectedMasterImage &&
          layoutRegions.filter(
            (r) => r.masterImageId === selectedMasterImage.id,
          ).length > 0 && (
            <Button
              onClick={() =>
                router.push(`/projects/${projectId}/03-region-info`)
              }
            >
              次へ: 領域情報を編集
            </Button>
          )}
      </PageHeader>

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Page Navigation - moved to top center */}
        {masterImages.length > 1 && (
          <div className="flex items-center justify-center border-b py-3">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentIndex = masterImages.findIndex(
                    (img) => img.id === selectedMasterImage?.id,
                  )
                  if (currentIndex > 0) {
                    handleMasterImageChange(masterImages[currentIndex - 1].id)
                  }
                }}
                disabled={
                  isLoading ||
                  isSaving ||
                  masterImages.findIndex(
                    (img) => img.id === selectedMasterImage?.id,
                  ) === 0
                }
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select
                value={selectedMasterImage?.id ?? ""}
                onValueChange={handleMasterImageChange}
                disabled={isLoading || isSaving}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="ページを選択" />
                </SelectTrigger>
                <SelectContent>
                  {masterImages.map((img) => (
                    <SelectItem key={img.id} value={img.id}>
                      ページ {img.pageNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const currentIndex = masterImages.findIndex(
                    (img) => img.id === selectedMasterImage?.id,
                  )
                  if (currentIndex < masterImages.length - 1) {
                    handleMasterImageChange(masterImages[currentIndex + 1].id)
                  }
                }}
                disabled={
                  isLoading ||
                  isSaving ||
                  masterImages.findIndex(
                    (img) => img.id === selectedMasterImage?.id,
                  ) ===
                    masterImages.length - 1
                }
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Layout Editor - full height without padding */}
        <div className="min-h-0 flex-1">
          <LayoutRegionEditor
            areas={layoutRegions}
            setAreas={handleRegionsChange}
            disabled={isSaving}
            backgroundImageUrl={backgroundImageUrl}
            imageDimensions={imageDimensions}
            masterImageId={selectedMasterImage?.id || null}
          />
        </div>
      </div>
    </div>
  )
}
