"use client"

import type { MasterAnswerGalleryProps } from "@/components/exams/01-upload/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"

import { MasterAnswerCard } from "./MasterAnswerCard"

/**
 * MasterAnswerGallery - 模範解答画像一覧を表示するコンポーネント
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
export function MasterAnswerGallery({
  answers,
  imageUrls,
  isDeleting,
  isMoving,
  onDeleteAnswer,
  onMoveAnswer,
  onPageSizeChange,
}: MasterAnswerGalleryProps) {
  // 画像がない場合は何も表示しない
  if (answers.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>模範解答 ({answers.length}ページ)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full rounded-md border whitespace-nowrap">
          <div className="flex space-x-4 p-4">
            {answers.map((answer, index) => {
              const imageUrl = imageUrls[answer.id]
              const currentAnswerIsDeleting = isDeleting[answer.id]

              return imageUrl ? (
                <MasterAnswerCard
                  key={answer.id}
                  answer={answer}
                  imageUrl={imageUrl}
                  index={index}
                  totalAnswers={answers.length}
                  isDeleting={currentAnswerIsDeleting}
                  isMoving={isMoving}
                  onDelete={() => onDeleteAnswer(answer.id)}
                  onMoveLeft={() => onMoveAnswer(index, "left")}
                  onMoveRight={() => onMoveAnswer(index, "right")}
                  onPageSizeChange={(pageSize) =>
                    onPageSizeChange(answer.id, pageSize)
                  }
                />
              ) : (
                <div
                  key={answer.id}
                  className="group relative flex h-48 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border"
                >
                  <p className="text-xs text-muted-foreground">画像準備中...</p>
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
