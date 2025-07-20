"use client"

import { Button } from "@/components/ui/button"
import PageHeader from "@/components/layout/PageHeader"
import { MasterImage } from "@prisma/client"
import { LayoutRegionArea } from "@/types/common.types"

interface TemplateHeaderProps {
  /** ヘルプボタン要素 */
  helpButton: React.ReactNode
  /** プロジェクトID */
  projectId: string
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
  projectId,
  selectedMasterImage,
  layoutRegions,
  onNextStep,
}: TemplateHeaderProps) {
  // 現在選択中の画像に対応する領域があるかチェック
  const hasRegionsForCurrentImage =
    selectedMasterImage &&
    layoutRegions.filter((r) => r.masterImageId === selectedMasterImage.id).length > 0

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