"use client"

import { useQuery } from "@tanstack/react-query"
import { AlertTriangle, Loader2 } from "lucide-react"

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
        <AlertDialogTitle className="flex items-center gap-2 text-red-600">
          <AlertTriangle className="h-5 w-5" />
          答案画像の削除確認
        </AlertDialogTitle>
        <AlertDialogDescription>
          以下の答案画像を削除しようとしています。この操作は取り消せません。
        </AlertDialogDescription>
      </AlertDialogHeader>

      <div className="space-y-4">
        {studentName && (
          <div className="rounded bg-gray-50 p-2">
            <p className="font-medium">生徒名: {studentName}</p>
            {pageNumber && <p>ページ: {pageNumber}</p>}
          </div>
        )}

        <div className="rounded bg-red-50 p-3 text-red-800">
          <p className="font-medium">⚠️ 警告</p>
          <ul className="mt-1 list-inside list-disc space-y-1 text-sm">
            <li>この操作は取り消せません</li>
            <li>答案画像ファイルが完全に削除されます</li>
            {isLoadingCounts && (
              <li className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                採点データを確認しています…
              </li>
            )}
            {/* 照会に失敗したら「採点データは無い」と誤解させないよう、安全側に
                倒して削除させない。見ていない件数は添えようがない（0件と偽って
                添えると、実際には在る採点を巻き添えに消すか、必ず中止されるかの
                どちらかになる） */}
            {countsError && (
              <>
                <li>{countsError}</li>
                <li className="font-medium">
                  何が消えるか数えられなかったため削除できません。開き直してください
                </li>
              </>
            )}
            {shownCounts && shownCounts.length > 0 && (
              <li className="font-medium">
                この答案の採点データも全て削除されます
                <ul className="mt-1 list-inside list-[circle] space-y-0.5 pl-4 font-normal">
                  {shownCounts.map((deletionCount) => (
                    <li key={deletionCount.countedName}>
                      {deletionCount.countedName}: {deletionCount.shownCount}件
                    </li>
                  ))}
                </ul>
              </li>
            )}
            {shownCounts && shownCounts.length === 0 && (
              <li>この答案にはまだ採点データがありません</li>
            )}
          </ul>
        </div>

        {/* 数えた後に他の教員が書き足していれば main が中止する。閉じずに
            数え直した結果を見せ、利用者にもう一度決めてもらう */}
        {refusalMessage && (
          <p className="rounded bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {refusalMessage}
          </p>
        )}

        <p className="text-sm text-gray-600">
          本当に削除してもよろしいですか？
        </p>
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
          className="bg-red-600 hover:bg-red-700"
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
