"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, Loader2, Trash2 } from "lucide-react"
import Image from "next/image"
import React from "react"
import type { MasterImageCardProps } from "../types"

/**
 * MasterImageCard - 個別の模範解答画像カードコンポーネント
 * 
 * 機能:
 * - 模範解答画像の表示
 * - 画像の削除操作
 * - 画像の順序変更（左右移動）
 * - 読み込み中・処理中の状態表示
 * - エラー処理
 * 
 * @param image - 模範解答画像データ
 * @param imageUrl - 画像のURL
 * @param index - 配列内のインデックス
 * @param totalImages - 全画像数
 * @param isDeleting - 削除処理中かどうか
 * @param isMoving - 移動処理中かどうか
 * @param onDelete - 削除実行のコールバック関数
 * @param onMoveLeft - 左移動のコールバック関数
 * @param onMoveRight - 右移動のコールバック関数
 * @returns 模範解答画像カードコンポーネント
 */
const MasterImageCard = React.memo<MasterImageCardProps>(
  ({
    image,
    imageUrl,
    index,
    totalImages,
    isDeleting,
    isMoving,
    onDelete,
    onMoveLeft,
    onMoveRight,
  }) => {
    // 移動可能性の判定
    const canMoveLeft = index > 0
    const canMoveRight = index < totalImages - 1
    const isDisabled = isDeleting || isMoving

    /**
     * 画像読み込みエラー時のハンドラー
     * @param e - エラーイベント
     */
    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.alt = `画像読込エラー: ${image.path}`
      console.error(
        "Failed to load image:",
        image.path,
        "using URL:",
        imageUrl,
      )
    }

    return (
      <div className="group relative flex h-48 w-40 shrink-0 overflow-hidden rounded-md border">
        <Image
          src={imageUrl}
          alt={`ページ ${image.pageNumber}`}
          className="h-full w-full object-cover"
          width={160}
          height={192}
          unoptimized
          onError={handleImageError}
        />

        {/* 処理中オーバーレイ */}
        {(isDeleting || (isMoving && !isDeleting)) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {/* 操作ボタンオーバーレイ */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 ${
            isDisabled
              ? "opacity-0"
              : "opacity-0 transition-opacity group-hover:opacity-100"
          }`}
        >
          <p className="text-sm font-semibold text-white">
            ページ {image.pageNumber}
          </p>
          <div className="mt-2 flex space-x-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveLeft}
              disabled={!canMoveLeft || isDisabled}
              title="左へ移動"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={onDelete}
              disabled={isDisabled}
              title="削除"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveRight}
              disabled={!canMoveRight || isDisabled}
              title="右へ移動"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

MasterImageCard.displayName = "MasterImageCard"

export { MasterImageCard }