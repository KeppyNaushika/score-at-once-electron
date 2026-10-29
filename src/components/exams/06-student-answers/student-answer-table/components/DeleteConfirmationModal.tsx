"use client"

import { useQuery } from "@tanstack/react-query"

import { ConfirmationTitleRow } from "@/components/common/ConfirmationTitleRow"
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
import { buttonVariants } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useConfirmedDeletion } from "@/hooks/useConfirmedDeletion"
import { studentAnswerDeletionCountsQuery } from "@/queries/answerSheet"
import type { ConfirmedDeletionCount } from "@/types/deletionConfirmation.types"

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  /**
   * 削除の実行。**利用者に見せた件数を添えて渡す**ので、main は消す直前に
   * 数え直せる。中止されたら投げること（このダイアログが受け止めて開いたままにする）
   */
  onConfirm: (confirmedCounts: ConfirmedDeletionCount[]) => Promise<void>
  /** 採点データの照会に使う StudentAnswerImage.id */
  fileId: string
  studentName?: string
  pageNumber?: number
}

/**
 * 採点データの照会（開いている間だけの状態）。
 *
 * AlertDialog は閉じている間 Content をマウントしないので、開くたびの初期化は
 * 作り直しで済む。全マス分を先読みすると採点データ量に比例して重くなるため、
 * 開いたときだけ照会する。
 */
function DeleteConfirmationBody({
  onClose,
  onConfirm,
  fileId,
  studentName,
  pageNumber,
}: Omit<DeleteConfirmationModalProps, "isOpen">) {
  // **`isFetching` で止める。** `isPending` は初回だけなので、キャッシュに残って
  // いれば古い答えのまま確定できてしまう（開くたびの取り直しが着地する前に押せる）
  const {
    data: deletionCounts,
    isFetching: isLoadingCounts,
    error,
    refetch,
  } = useQuery(studentAnswerDeletionCountsQuery(fileId))
  const countsError = error ? error.message : null

  // **表示にも送信にも同じ配列を使う。** 見せたものと送るものが同じなら食い違わない。
  // 取り直している間・照会に失敗した間は null（＝押させない）
  const shownCounts =
    isLoadingCounts || deletionCounts === undefined ? null : deletionCounts

  const { canConfirm, isDeleting, refusalMessage, confirmDeletion } =
    useConfirmedDeletion({
      confirmedCounts: shownCounts,
      deleteWithConfirmedCounts: onConfirm,
      recount: refetch,
    })

  const handleConfirm = async () => {
    if (await confirmDeletion()) onClose()
  }

  return (
    <>
      <AlertDialogHeader>
        <ConfirmationTitleRow variant="destructive">
          <AlertDialogTitle>答案画像を削除しますか？</AlertDialogTitle>
        </ConfirmationTitleRow>
        <AlertDialogDescription>
          以下の答案画像のファイルを削除します。この操作は元に戻すことができません。
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-2 text-sm">
        {studentName && (
          <div className="rounded-md border bg-gray-50 p-2">
            <p className="font-medium">生徒名: {studentName}</p>
            {pageNumber && <p>ページ: {pageNumber}</p>}
          </div>
        )}

        {isLoadingCounts && (
          <p className="flex items-center gap-1 text-muted-foreground">
            <Spinner className="size-3" />
            採点データを確認しています…
          </p>
        )}
        {/* 照会に失敗したら「採点データは無い」と誤解させないよう、安全側に
            倒して削除させない。見ていない件数は添えようがない（0件と偽って
            添えると、実際には在る採点を巻き添えに消すか、必ず中止されるかの
            どちらかになる） */}
        {countsError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-800">
            <p>{countsError}</p>
            <p className="font-medium">
              何が消えるか数えられなかったため削除できません。開き直してください
            </p>
          </div>
        )}
        {shownCounts && shownCounts.length > 0 && (
          <div>
            <p className="font-medium">
              この答案の採点データも全て削除されます
            </p>
            <ul className="pl-4 text-muted-foreground">
              {shownCounts.map((deletionCount) => (
                <li key={deletionCount.countedName}>
                  ・{deletionCount.countedName}: {deletionCount.shownCount}件
                </li>
              ))}
            </ul>
          </div>
        )}
        {shownCounts && shownCounts.length === 0 && (
          <p className="text-muted-foreground">
            この答案にはまだ採点データがありません
          </p>
        )}

        {/* 数えた後に他の教員が書き足していれば main が中止する。閉じずに
            数え直した結果を見せ、利用者にもう一度決めてもらう */}
        {refusalMessage && (
          <p className="rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {refusalMessage}
          </p>
        )}
      </div>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onClose} disabled={isDeleting}>
          キャンセル
        </AlertDialogCancel>
        <AlertDialogAction
          // 既定の「クリックで閉じる」を止める。中止されたときに開いたままにして
          // 数え直した件数を見せるため
          onClick={(event) => {
            event.preventDefault()
            void handleConfirm()
          }}
          disabled={!canConfirm}
          className={buttonVariants({ variant: "destructive" })}
        >
          削除する
        </AlertDialogAction>
      </AlertDialogFooter>
    </>
  )
}

export function DeleteConfirmationModal({
  isOpen,
  ...bodyProps
}: DeleteConfirmationModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={bodyProps.onClose}>
      <AlertDialogContent>
        <DeleteConfirmationBody {...bodyProps} />
      </AlertDialogContent>
    </AlertDialog>
  )
}
