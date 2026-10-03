"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeft, ArrowRight, ImageUp, Trash2 } from "lucide-react"
import Image from "next/image"
import React, { useRef, useState } from "react"

import { CautionNotice } from "@/components/common/CautionNotice"
import { TooltipButton } from "@/components/common/TooltipButton"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import { DELETION_COUNT_NAME } from "@/lib/shared/deletionCountNames"
import {
  buildItemDeletionWarning,
  examPageUsages,
} from "@/lib/shared/gradeReferenceMessages"
import { examDetailQuery } from "@/queries/exam"

const PAGE_SIZE_OPTIONS = ["A3", "A4", "A5", "B4", "B5"] as const

/**
 * MasterAnswerCard - 模範解答ページ1件のカード
 *
 * 模範解答の差し替え・ページの削除・順序変更・用紙サイズ変更を行う。
 *
 * 削除はページごと消えるため、答案・設問（採点領域）が紐づいていれば、何が一緒に
 * 消えるか（答案の件数・設問の数・成績算出への影響）を示して確認を取る。どれも
 * 紐づいていない（画像を置いただけの）ページは確認なしで消す。成績算出が参照するのは
 * 設問なので、設問が無ければ成績算出の参照も無い。
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
    const cropRegionCount = answer.cropRegions.length
    const deletionCounts = [
      {
        countedName: DELETION_COUNT_NAME.pageAnswerSheet,
        shownCount: answerImageCount,
      },
      {
        countedName: DELETION_COUNT_NAME.cropRegion,
        shownCount: cropRegionCount,
      },
    ].filter((deletionCount) => deletionCount.shownCount > 0)
    // 答案も設問も無ければ確認なしで消す（設問が無ければ成績算出の参照も無い）
    const hasLinkedContent = deletionCounts.length > 0

    // ページ上の設問を使っている成績算出（設問のデータソースは消え、合計・小計は変わる）。
    // 使っているデータソースは試験の詳細（layout も読む）に同梱してある
    const examDetail = useQuery({
      ...examDetailQuery(answer.examId),
      enabled: confirmingDelete && cropRegionCount > 0,
    })
    const gradeWarning = examDetail.data
      ? buildItemDeletionWarning(
          "examPage",
          examPageUsages(examDetail.data, answer.id)
        )
      : null

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
            <Spinner className="size-8 text-white" />
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
              : "opacity-0 transition-opacity group-hover:opacity-100 has-data-[state=open]:opacity-100"
          }`}
        >
          <p className="text-sm font-semibold text-white">
            ページ {answer.pageNumber}
          </p>
          <Select
            value={answer.pageSize}
            onValueChange={onPageSizeChange}
            disabled={isBusy}
          >
            <SelectTrigger
              aria-label="用紙サイズ"
              className="mt-1 gap-1 rounded border-0 bg-white/20 px-1.5 py-0.5 text-xs text-white shadow-none backdrop-blur-sm data-[size=default]:h-auto [&_svg:not([class*='text-'])]:text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((pageSize) => (
                <SelectItem key={pageSize} value={pageSize}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-2 flex space-x-1">
            <TooltipButton
              label="左へ移動"

              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveLeft}
              disabled={!canMoveLeft || isBusy}
            >
              <ArrowLeft className="h-4 w-4" />
            </TooltipButton>
            <TooltipButton
              label="模範解答画像を差し替え（答案・採点結果は残る）"

              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              <ImageUp className="h-4 w-4" />
            </TooltipButton>
            <TooltipButton
              label="このページを削除"

              size="icon"
              variant="destructive"
              className="h-7 w-7"
              onClick={() => {
                if (hasLinkedContent) {
                  setConfirmingDelete(true)
                  return
                }
                // 何も紐づいていなければ確認なしで消す。見た後に他の教員が答案・
                // 設問を足していて main が中止したときだけ、確認画面で文言を見せる
                void confirmDeletion().then((deleted) => {
                  if (!deleted) setConfirmingDelete(true)
                })
              }}
              disabled={isBusy}
            >
              <Trash2 className="h-4 w-4" />
            </TooltipButton>
            <TooltipButton
              label="右へ移動"

              size="icon"
              variant="ghost"
              className="h-7 w-7 text-white hover:bg-white/20"
              onClick={onMoveRight}
              disabled={!canMoveRight || isBusy}
            >
              <ArrowRight className="h-4 w-4" />
            </TooltipButton>
          </div>
        </div>

        <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ページ {answer.pageNumber} を削除しますか？
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  このページと一緒に、次のものも削除されます。
                </span>
                <span className="block pl-4 text-muted-foreground">
                  {answerImageCount > 0 && (
                    <span className="block">
                      ・このページに取り込まれている
                      {DELETION_COUNT_NAME.pageAnswerSheet} {answerImageCount}{" "}
                      件と、その採点結果
                    </span>
                  )}
                  {cropRegionCount > 0 && (
                    <span className="block">
                      ・ページ上の設問（採点領域） {cropRegionCount} 個
                    </span>
                  )}
                </span>
                <span className="block">
                  模範解答の画像を取り替えたいだけなら、削除ではなく差し替えを使ってください。
                </span>
              </AlertDialogDescription>
              {gradeWarning && <CautionNotice>{gradeWarning}</CautionNotice>}
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
                // 試験の詳細が読めるまでは押させない（影響を見せる前に消さない）
                disabled={
                  !canConfirm || (cropRegionCount > 0 && examDetail.isPending)
                }
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
