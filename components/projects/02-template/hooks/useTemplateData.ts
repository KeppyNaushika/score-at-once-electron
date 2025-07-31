import { CropRegionArea } from "@/types/common.types"
import { useCallback, useState } from "react"
import { toast } from "sonner"
import { AreaType, ImageDimensions, InitialDataState } from "@/components/projects/02-template/types"
type MasterImage = {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}

/**
 * テンプレートページの初期データ読み込みと状態管理を担当するカスタムフック
 *
 * @param projectId - プロジェクトID
 * @returns 初期データ読み込み関連の状態と関数
 */
export function useTemplateData(projectId: string | undefined) {
  // 初期データの状態管理
  const [initialData, setInitialData] = useState<InitialDataState>({
    project: null,
    currentUser: null,
    masterImages: [],
    selectedMasterImage: null,
    backgroundImageUrl: null,
    imageDimensions: null,
    cropRegions: [],
    layoutId: undefined,
  })

  const [isLoading, setIsLoading] = useState(true)

  /**
   * 画像の寸法を取得する補助関数
   *
   * @param imageUrl - 画像のURL
   * @returns Promise<ImageDimensions | null> 画像の寸法情報
   */
  const loadImageDimensions = useCallback(
    (imageUrl: string): Promise<ImageDimensions | null> => {
      return new Promise((resolve) => {
        const img = new Image()
        img.onload = () => {
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight,
          })
        }
        img.onerror = () => {
          resolve(null)
        }
        img.src = imageUrl
      })
    },
    [],
  )

  /**
   * 初期データの読み込み処理
   * プロジェクト情報、ユーザー情報、マスター画像、既存の領域データを取得する
   */
  const loadInitialData = useCallback(async () => {
    if (!projectId) {
      toast.error("プロジェクトIDが見つかりません。")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      // ユーザー情報を取得
      const user = await window.electronAPI.getCurrentUser()

      // プロジェクト情報を取得
      const fetchedProject =
        await window.electronAPI.fetchProjectById(projectId)

      if (!fetchedProject) {
        toast.error("プロジェクトが見つかりません。")
        setInitialData((prev) => ({
          ...prev,
          project: null,
          currentUser: user,
          masterImages: [],
          selectedMasterImage: null,
          backgroundImageUrl: null,
          imageDimensions: null,
          cropRegions: [],
        }))
        return
      }

      // マスター画像の処理
      let processedMasterImages: MasterImage[] = []
      let selectedImage: MasterImage | null = null
      let backgroundUrl: string | null = null
      let dimensions: ImageDimensions | null = null

      if (
        fetchedProject.projectPages &&
        fetchedProject.projectPages.length > 0
      ) {
        // projectPagesからmaster imagesを抽出してソート
        const masterImages = fetchedProject.projectPages
          .filter((page) =>
            page.pageImages?.some((img) => img.imageType === "MASTER"),
          )
          .map((page) => {
            const masterImage = page.pageImages?.find(
              (img) => img.imageType === "MASTER",
            )
            return {
              id: page.id,
              projectId: page.projectId,
              imagePath: masterImage?.imagePath || "",
              pageNumber: page.pageNumber,
              createdAt: page.createdAt,
              updatedAt: page.updatedAt,
            }
          })
          .sort((a, b) => a.pageNumber - b.pageNumber)

        processedMasterImages = masterImages
        selectedImage = processedMasterImages[0]

        // 最初の画像のURLと寸法を取得
        backgroundUrl = await window.electronAPI.resolveFileProtocolPath(
          selectedImage.imagePath,
        )
        dimensions = await loadImageDimensions(backgroundUrl)
      }

      // 既存のレイアウト領域を取得
      let regions: CropRegionArea[] = []
      let layoutIdValue: string | undefined

      try {
        const existingRegions =
          await window.electronAPI.getCropRegionsByProjectId(projectId)

        if (existingRegions && existingRegions.length > 0) {
          layoutIdValue = "existing"

          // 最初のマスター画像に対応する領域のみをフィルター
          const firstMasterImageId = selectedImage?.id
          const currentImageRegions = firstMasterImageId
            ? existingRegions.filter(
                (region) => region.projectPage?.id === firstMasterImageId,
              )
            : []

          regions = currentImageRegions.map((region) => ({
            id: region.id,
            type: region.type as AreaType,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            label: region.label || "",
            points: region.points ? String(region.points) : null,
            projectPageId: region.projectPage?.id || "",
          }))
        }
      } catch (regionError) {
        console.error("Failed to load layout regions:", regionError)
        layoutIdValue = undefined
        regions = []
      }

      // 状態を更新
      setInitialData({
        project: fetchedProject,
        currentUser: user,
        masterImages: processedMasterImages,
        selectedMasterImage: selectedImage,
        backgroundImageUrl: backgroundUrl,
        imageDimensions: dimensions,
        cropRegions: regions,
        layoutId: layoutIdValue,
      })
    } catch (error) {
      console.error("Failed to load initial data:", error)
      toast.error("初期データの読み込みに失敗しました。")
    } finally {
      setIsLoading(false)
    }
  }, [projectId, loadImageDimensions])

  /**
   * マスター画像の変更処理
   * 選択された画像に対応する領域データを読み込む
   *
   * @param imageId - 選択する画像のID
   */
  const handleMasterImageChange = useCallback(
    async (imageId: string) => {
      const image = initialData.masterImages.find((img) => img.id === imageId)
      if (!image || !projectId) return

      try {
        // 新しい画像のURLと寸法を取得
        const url = await window.electronAPI.resolveFileProtocolPath(
          image.imagePath,
        )
        const dimensions = await loadImageDimensions(url)

        // 新しいページの領域を読み込む
        const allRegions =
          await window.electronAPI.getCropRegionsByProjectId(projectId)
        const currentImageRegions = allRegions.filter(
          (region) => region.projectPage?.id === image.id,
        )

        const mappedRegions: CropRegionArea[] =
          currentImageRegions.length > 0
            ? currentImageRegions.map((region) => ({
                id: region.id,
                type: region.type as AreaType,
                x: region.x,
                y: region.y,
                width: region.width,
                height: region.height,
                label: region.label || "",
                points: region.points ? String(region.points) : null,
                projectPageId: region.projectPage?.id || "",
              }))
            : []

        // 状態を更新
        setInitialData((prev) => ({
          ...prev,
          selectedMasterImage: image,
          backgroundImageUrl: url,
          imageDimensions: dimensions,
          cropRegions: mappedRegions,
        }))
      } catch (error) {
        toast.error("背景画像の読み込みに失敗しました。")
        console.error("Failed to change master image:", error)
      }
    },
    [initialData.masterImages, projectId, loadImageDimensions],
  )

  /**
   * レイアウト領域の状態を更新する
   *
   * @param regions - 新しい領域データ
   */
  const updateCropRegions = useCallback((regions: CropRegionArea[]) => {
    setInitialData((prev) => ({
      ...prev,
      cropRegions: regions,
    }))
  }, [])

  /**
   * レイアウトIDの状態を更新する
   *
   * @param layoutId - 新しいレイアウトID
   */
  const updateLayoutId = useCallback((layoutId: string | undefined) => {
    setInitialData((prev) => ({
      ...prev,
      layoutId,
    }))
  }, [])

  return {
    initialData,
    isLoading,
    loadInitialData,
    handleMasterImageChange,
    updateCropRegions,
    updateLayoutId,
  }
}
