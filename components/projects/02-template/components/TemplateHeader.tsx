"use client"

import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
type MasterImage = {
  id: string
  projectId: string
  imagePath: string
  pageNumber: number
  createdAt: Date
  updatedAt: Date
}
import { LayoutRegionArea } from "@/types/common.types"

interface TemplateHeaderProps {
  /** ヘルプボタン要素 */
  helpButton: React.ReactNode
  /** 選択中のマスター画像 */
  selectedMasterImage: MasterImage | null
  /** レイアウト領域データ */
  layoutRegions: LayoutRegionArea[]
  /** 次のステップへ進むコールバック */
  onNextStep: () => void
}

/**
 * テンプレートページのヘッダーコンポーネント
 * タイトル、説明、次のステップボタンを表示
 */
export function TemplateHeader({
  helpButton,
  selectedMasterImage,
  layoutRegions,
  onNextStep,
}: TemplateHeaderProps) {
  // 現在選択中の画像に対応する領域があるかチェック
  const hasRegionsForCurrentImage =
    selectedMasterImage &&
    layoutRegions.filter((r) => r.projectPageId === selectedMasterImage.id).length > 0

  return (
    <PageHeader 
      title="採点領域の作成" 
      description="" 
      helpButton={helpButton}
    >
      {hasRegionsForCurrentImage && (
        <Button onClick={onNextStep}>
          次へ: 領域情報を編集
        </Button>
      )}
    </PageHeader>
  )
}