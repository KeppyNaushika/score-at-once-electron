"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
type MasterImage = {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}

interface PageNavigationProps {
  /** マスター画像の配列 */
  masterImages: MasterImage[]
  /** 現在選択中のマスター画像 */
  selectedMasterImage: MasterImage | null
  /** 画像変更時のコールバック */
  onImageChange: (imageId: string) => void
  /** 読み込み状態 */
  isLoading: boolean
  /** 保存状態 */
  isSaving: boolean
}

/**
 * ページナビゲーションコンポーネント
 * 複数ページの模範解答を切り替えるためのUI
 */
export function PageNavigation({
  masterImages,
  selectedMasterImage,
  onImageChange,
  isLoading,
  isSaving,
}: PageNavigationProps) {
  // ページが1ページのみの場合は非表示
  if (masterImages.length <= 1) {
    return null
  }

  const currentIndex = masterImages.findIndex(
    (img) => img.id === selectedMasterImage?.id
  )

  /**
   * 前のページに移動
   */
  const goToPreviousPage = () => {
    if (currentIndex > 0) {
      onImageChange(masterImages[currentIndex - 1].id)
    }
  }

  /**
   * 次のページに移動
   */
  const goToNextPage = () => {
    if (currentIndex < masterImages.length - 1) {
      onImageChange(masterImages[currentIndex + 1].id)
    }
  }

  return (
    <div className="flex items-center justify-center border-b py-3">
      <div className="flex items-center space-x-2">
        {/* 前のページボタン */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousPage}
          disabled={isLoading || isSaving || currentIndex === 0}
          aria-label="前のページ"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* ページ選択ドロップダウン */}
        <Select
          value={selectedMasterImage?.id ?? ""}
          onValueChange={onImageChange}
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

        {/* 次のページボタン */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextPage}
          disabled={
            isLoading || isSaving || currentIndex === masterImages.length - 1
          }
          aria-label="次のページ"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
