"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import type { MasterImage, MasterImageGalleryProps } from "../types"
import { MasterImageCard } from "./master-image-card"

/**
 * MasterImageGallery - 模範解答画像一覧を表示するコンポーネント
 * 
 * 機能:
 * - 模範解答画像の一覧表示
 * - 水平スクロール対応
 * - 画像の削除・順序変更操作
 * - 読み込み状態の表示
 * 
 * @param images - 模範解答画像のリスト
 * @param imageUrls - 画像IDとURLのマッピング
 * @param isDeleting - 削除処理中の画像IDマップ
 * @param isMoving - 移動処理中の状態
 * @param onDeleteImage - 画像削除のコールバック関数
 * @param onMoveImage - 画像移動のコールバック関数
 * @returns 模範解答画像一覧コンポーネント。画像がない場合はnullを返す
 */
export function MasterImageGallery({
  images,
  imageUrls,
  isDeleting,
  isMoving,
  onDeleteImage,
  onMoveImage,
}: MasterImageGalleryProps) {
  // 画像がない場合は何も表示しない
  if (images.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>模範解答 ({images.length}ページ)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full rounded-md border whitespace-nowrap">
          <div className="flex space-x-4 p-4">
            {images.map((image, index) => {
              const imageUrl = imageUrls[image.id]
              const currentImageIsDeleting = isDeleting[image.id]

              return imageUrl ? (
                <MasterImageCard
                  key={image.id}
                  image={image}
                  imageUrl={imageUrl}
                  index={index}
                  totalImages={images.length}
                  isDeleting={currentImageIsDeleting}
                  isMoving={isMoving}
                  onDelete={() => onDeleteImage(image.id)}
                  onMoveLeft={() => onMoveImage(index, "left")}
                  onMoveRight={() => onMoveImage(index, "right")}
                />
              ) : (
                <div
                  key={image.id}
                  className="group relative flex h-48 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                >
                  <p className="text-muted-foreground text-xs">
                    画像準備中...
                  </p>
                </div>
              )
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  )
}