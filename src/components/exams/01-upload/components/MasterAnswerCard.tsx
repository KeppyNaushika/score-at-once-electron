"use client"

import { ArrowLeft, ArrowRight, ImageUp, Loader2, Trash2 } from "lucide-react"
import Image from "next/image"
import React, { useRef, useState } from "react"

import type { MasterAnswerCardProps } from "@/components/exams/01-upload/types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"

const PAGE_SIZE_OPTIONS = ["A3", "A4", "A5", "B4", "B5"] as const

/**
 * MasterAnswerCard - 模範解答ページ1件のカード
 *
 * 模範解答の差し替え・ページの削除・順序変更・用紙サイズ変更を行う。
 *
 * 削除はページごと消えるため、答案が取り込まれていれば件数を示して確認を取る。
 * 画像を取り替えたいだけなら差し替えを使う（答案も採点結果も残る）。
 */
const MasterAnswerCard = React.memo<MasterAnswerCardProps>(
  ({
    answer,
    imageUrl,
    index,
    totalAnswers,
    isDeleting,
    isReplacing,
    isMoving,
    onDelete,
    onReplace,
    onMoveLeft,
    onMoveRight,
    onPageSizeChange,
  }) => {
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const canMoveLeft = index > 0
    const canMoveRight = index < totalAnswers - 1
    const isBusy = isDeleting || isMoving || isReplacing

    // **表示にも送信にも同じ配列を使う**（見せたものと送るものが同じなら食い違わない）。
    // main は消す直前にこれと同じ定義で数え直し、増えていれば中止する（段階26）
    const answerImageCount = answer.studentAnswerImages.length
    const deletionCounts =
      answerImageCount > 0
        ? [
            {
              countedName: DELETION_COUNT_NAME.pageAnswerSheet,
              shownCount: answerImageCount,
            },
          ]
        : []

    const { canConfirm, refusalMessage, confirmDeletion } =
      useConfirmedDeletion({
        confirmedCounts: deletionCounts,
        deleteWithConfirmedCounts: onDelete,
        // 件数は試験のまとまりの取得結果から数えているので、削除の失敗で無効化された
        // 一覧が届けば数え直したことになる（ここで追加の取得はしない）
        recount: () => Promise.resolve(),
      })

    const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.alt = `画像読込エラー: ${answer.imagePath}`
      console.error(
        "Failed to load image:",
        answer.imagePath,
        "using URL:",
        imageUrl
      )
    }

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // 同じファイルを選び直しても change が発火するように値を戻す
      event.target.value = ""
      if (file) onReplace(file)
    }

    return (
      <div className="group relative flex h-48 w-40 shrink-0 overflow-hidden rounded-md border">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={`ページ ${answer.pageNumber}`}
            className="h-full w-full object-cover"
            width={160}
            height={192}
            unoptimized
            onError={handleImageError}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted px-2 text-center">
            <p className="text-xs text-muted-foreground">
              模範解答なし
              <br />
              差し替えてください
            </p>
          </div>
        )}

        {isBusy && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* 操作ボタンオーバーレイ */}
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center bg-black/50 ${
            isBusy
              ? "opacity-0"
              : "opacity-0 transition-opacity group-hover:opacity-100"
          }`}
        >
          <p className="text-sm font-semibold text-white">
            ページ {answer.pageNumber}
          </p>
          <select
            className="mt-1 rounded bg-white/20 px-1.5 py-0.5 text-xs text-white backdrop-blur-sm"
            value={answer.pageSize}
            onChange={(e) => {
              e.stopPropagation()
              onPageSizeChange(e.target.value)
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={isBusy}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size} className="text-black">
                {size}
              </option>
            ))}
          </select>
          <div className="mt-2 flex space-x-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveLeft}
              disabled={!canMoveLeft || isBusy}
              title="左へ移動"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
              title="模範解答画像を差し替え（答案・採点結果は残る）"
            >
              <ImageUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={() => setConfirmingDelete(true)}
              disabled={isBusy}
              title="このページを削除"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveRight}
              disabled={!canMoveRight || isBusy}
              title="右へ移動"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ページ {answer.pageNumber} を削除しますか？
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deletionCounts.length > 0
                  ? `このページに取り込まれている${DELETION_COUNT_NAME.pageAnswerSheet} ${answerImageCount} 件と、その採点結果も一緒に削除されます。模範解答の画像を取り替えたいだけなら、削除ではなく差し替えを使ってください。`
                  : "このページと、ページ上の採点領域が削除されます。"}
              </AlertDialogDescription>
              {/* 数えた後に他の教員が取り込んでいれば main が中止する。閉じずに
                  文言を出し、利用者にもう一度決めてもらう */}
              {refusalMessage && (
                <p className="rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
                  {refusalMessage}
                </p>
              )}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                // 既定の「クリックで閉じる」を止める。中止されたときに開いたままにする
                onClick={(event) => {
                  event.preventDefault()
                  void confirmDeletion().then((deleted) => {
                    if (deleted) setConfirmingDelete(false)
                  })
                }}
                disabled={!canConfirm}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                削除する
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    )
  }
)

MasterAnswerCard.displayName = "MasterAnswerCard"

export { MasterAnswerCard }
