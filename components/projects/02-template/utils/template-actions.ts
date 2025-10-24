import { CropRegionArea, CropRegionAreaType } from "@/types/common.types"
import { User } from "@prisma/client"
import { toast } from "sonner"

/**
 * テンプレート保存処理
 * 現在の全領域をデータベースに保存する
 *
 * @param projectId - プロジェクトID
 * @param currentUser - 現在のユーザー
 * @param selectedMasterImageId - 選択中のマスター画像ID
 * @param cropRegions - 保存する領域データ配列
 * @returns Promise<{ success: boolean, savedRegions?: CropRegionData[] }>
 */
export async function saveTemplate(
  projectId: string,
  currentUser: User,
  selectedMasterImageId: string,
  cropRegions: CropRegionArea[],
): Promise<{ success: boolean; savedRegions?: CropRegionArea[] }> {
  if (!projectId || !currentUser || !selectedMasterImageId) {
    toast.error("プロジェクトID、ユーザー情報、基準画像は必須です。")
    return { success: false }
  }

  try {
    // 既存の領域を更新または新規作成
    const savePromises = cropRegions.map(async (area) => {
      if (!area.projectPageId) {
        throw new Error(
          `Crop region ${area.label || "Unnamed"} is missing projectPageId.`,
        )
      }

      const regionData = {
        projectPageId: area.projectPageId,
        type: area.type,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        label: area.label,
        points:
          typeof area.points === "string" ? parseInt(area.points) : area.points,
      }

      if (area.id) {
        // 既存の領域を更新
        return await window.electronAPI.updateCropRegion(area.id, regionData)
      } else {
        // 新しい領域を作成
        return await window.electronAPI.createCropRegion(regionData)
      }
    })

    const savedRegions = await Promise.all(savePromises)

    // 保存された領域データを整形
    const formattedRegions: CropRegionArea[] = savedRegions
      .filter((region) => region !== null)
      .map((region) => ({
        id: region!.id,
        type: region!.type as CropRegionAreaType,
        x: region!.x,
        y: region!.y,
        width: region!.width,
        height: region!.height,
        label: region!.label || "",
        points: region!.points,
        projectPageId: region!.projectPageId || "",
      }))

    toast.success(`採点枠を保存しました。`)
    return { success: true, savedRegions: formattedRegions }
  } catch (error) {
    console.error("Failed to save layout:", error)
    toast.error("採点枠の保存に失敗しました。")
    return { success: false }
  }
}

/**
 * 自動レイアウト検出処理
 * 将来実装予定の機能（現在は開発中メッセージを表示）
 *
 * @param selectedMasterImage - 選択中のマスター画像
 * @returns Promise<{ success: boolean, detectedRegions?: CropRegionData[] }>
 */
export async function detectCropRegions(
  selectedMasterImage: { path?: string } | null,
): Promise<{ success: boolean; detectedRegions?: CropRegionArea[] }> {
  if (!selectedMasterImage || !selectedMasterImage.path) {
    toast.error(
      "模範解答画像が選択されていないか、パスが無効です。自動検出を実行できません。",
    )
    return { success: false }
  }

  try {
    // 自動検出機能は将来実装予定
    toast.info("自動検出機能は現在開発中です。手動で領域を設定してください。")
    return { success: false }
  } catch (error) {
    console.error("Failed to detect crop regions:", error)
    toast.error(
      `採点枠領域の自動検出に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
    )
    return { success: false }
  }
}

/**
 * 次のステップへの遷移チェック
 * レイアウトが保存されているかを確認
 *
 * @param layoutId - レイアウトの保存状態ID
 * @returns boolean - 次のステップに進めるかどうか
 */
export function canProceedToNextStep(layoutId: string | undefined): boolean {
  if (!layoutId) {
    toast.error("採点枠が保存されていません。まず採点枠を保存してください。")
    return false
  }
  return true
}

/**
 * マスター画像の順序管理ユーティリティ
 * 現在選択中の画像の前後の画像を取得
 *
 * @param masterImages - マスター画像の配列
 * @param selectedImageId - 現在選択中の画像ID
 * @returns 前後の画像の情報
 */
export function getAdjacentImages(
  masterImages: Array<{ id: string; pageNumber: number }>,
  selectedImageId: string | undefined,
) {
  if (!selectedImageId) {
    return { previousImage: null, nextImage: null, currentIndex: -1 }
  }

  const currentIndex = masterImages.findIndex(
    (img) => img.id === selectedImageId,
  )

  return {
    previousImage: currentIndex > 0 ? masterImages[currentIndex - 1] : null,
    nextImage:
      currentIndex < masterImages.length - 1
        ? masterImages[currentIndex + 1]
        : null,
    currentIndex,
  }
}

/**
 * 領域データのバリデーション
 * 領域データが有効かどうかをチェック
 *
 * @param region - チェックする領域データ
 * @returns { isValid: boolean, errors: string[] }
 */
export function validateRegionData(region: CropRegionArea): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // 必須フィールドのチェック
  if (!region.type) {
    errors.push("領域タイプが設定されていません")
  }

  if (!region.label) {
    errors.push("ラベルが設定されていません")
  }

  if (!region.projectPageId) {
    errors.push("プロジェクトページIDが設定されていません")
  }

  // 座標の範囲チェック
  if (region.x < 0 || region.x > 1) {
    errors.push("X座標が有効範囲外です (0-1)")
  }

  if (region.y < 0 || region.y > 1) {
    errors.push("Y座標が有効範囲外です (0-1)")
  }

  if (region.width <= 0 || region.width > 1) {
    errors.push("幅が有効範囲外です (0-1)")
  }

  if (region.height <= 0 || region.height > 1) {
    errors.push("高さが有効範囲外です (0-1)")
  }

  // 座標と寸法の組み合わせチェック
  if (region.x + region.width > 1) {
    errors.push("領域が画像の右端を超えています")
  }

  if (region.y + region.height > 1) {
    errors.push("領域が画像の下端を超えています")
  }

  return {
    isValid: errors.length === 0,
    errors,
  }
}
