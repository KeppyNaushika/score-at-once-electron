"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
// Remove unused import
import { MasterImage, Prisma, User, Project, AreaType } from "@prisma/client"
import { useParams, useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useRef } from "react"
import { toast } from "sonner"
import { CropCoords } from "@/types/common.types"
import LayoutRegionEditor from "@/components/Project/LayoutRegionEditor"

// Remove unused type alias

export default function TemplateStepPage() {
  const params = useParams()
  const router = useRouter()

  const paramsProjectId = params.projectId
  const projectId =
    typeof paramsProjectId === "string" ? paramsProjectId : paramsProjectId?.[0]

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
      sourceAreaIdsJson: string | null
      sourceQuestionNumbersJson: string | null
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
          const existingRegions = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
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
                sourceAreaIdsJson: null,
                sourceQuestionNumbersJson: null,
                masterImageId: region.masterImageId || "",
              }))
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

  const handleMasterImageChange = async (imageId: string) => {
    const image = masterImages.find((img) => img.id === imageId)
    if (image) {
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
      } catch (error) {
        toast.error("背景画像の読み込みに失敗しました。")
        setBackgroundImageUrl(null)
        setImageDimensions(null)
      }
    }
  }

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
          sourceAreaIdsJson: area.sourceAreaIdsJson,
          sourceQuestionNumbersJson: area.sourceQuestionNumbersJson,
        }

        if (area.id) {
          // 既存の領域を更新
          return await window.electronAPI.updateLayoutRegion(area.id, regionData)
        } else {
          // 新しい領域を作成
          return await window.electronAPI.createLayoutRegion(regionData)
        }
      })

      const savedRegions = await Promise.all(savePromises)
      
      // 保存された領域でUIを更新
      setLayoutRegions(
        savedRegions.map((region) => ({
          id: region.id,
          type: region.type,
          x: region.x,
          y: region.y,
          width: region.width,
          height: region.height,
          label: region.label || "",
          points: region.points ? String(region.points) : null,
          questionNumber: region.questionNumber || "",
          sourceAreaIdsJson: null,
          sourceQuestionNumbersJson: null,
          masterImageId: region.masterImageId || "",
        }))
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
    alert("次のステップ（解答用紙アップロード）へ進みます。 (未実装)")
  }
  const goToPreviousStep = () => {
    router.push(`/projects/${projectId}/score`)
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
    <div className="container mx-auto p-4">
      <h2 className="mb-6 text-2xl font-semibold">
        ステップ2: 採点枠領域の作成・編集
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>{layoutId ? "採点枠編集" : "新規採点枠作成"} </CardTitle>
          <CardDescription>
            プロジェクト「{project?.examName || projectId}
            」の採点枠領域を設定します。
            {masterImages.length > 0 && (
              <div className="mt-2">
                <Label htmlFor="master-image-select">基準画像選択:</Label>
                <Select
                  value={selectedMasterImage?.id || ""}
                  onValueChange={handleMasterImageChange}
                  disabled={isLoading || isSaving}
                >
                  <SelectTrigger
                    id="master-image-select"
                    className="mt-1 w-[280px]"
                  >
                    <SelectValue placeholder="模範解答画像を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {masterImages.map((img) => (
                      <SelectItem key={img.id} value={img.id}>
                        {img.path.split("/").pop()} (ページ {img.pageNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>採点枠領域定義</Label>
              {selectedMasterImage && (
                <Button
                  onClick={handleDetectLayoutRegions}
                  disabled={
                    isSaving || isLoading || isDetecting || !selectedMasterImage
                  }
                  size="sm"
                  variant="outline"
                >
                  {isDetecting ? "検出中..." : "解答枠を自動検出"}
                </Button>
              )}
            </div>
            <LayoutRegionEditor
              areas={layoutRegions}
              setAreas={setLayoutRegions}
              disabled={isSaving}
              backgroundImageUrl={backgroundImageUrl}
              imageDimensions={imageDimensions}
              masterImageId={selectedMasterImage?.id || null}
            />
            <p className="text-muted-foreground text-xs">
              模範解答画像上で、採点対象となる各領域（設問、氏名など）を定義します。座標・サイズは画像に対する割合で保存されます。各領域は特定の模範解答画像ページに紐付きます。
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={goToPreviousStep}
            disabled={isSaving}
          >
            前へ: 模範解答設定
          </Button>
          <div className="flex space-x-2">
            <Button
              onClick={handleSaveTemplate}
              disabled={
                isSaving || isLoading || !selectedMasterImage || isDetecting
              }
            >
              {isSaving
                ? "保存中..."
                : layoutId
                  ? "採点枠を更新"
                  : "採点枠を作成"}{" "}
            </Button>
            <Button
              onClick={goToNextStep}
              disabled={
                isSaving || !layoutId || !selectedMasterImage || isDetecting
              }
            >
              次へ: 解答用紙アップロード
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
