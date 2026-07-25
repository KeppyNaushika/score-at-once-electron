"use client"

import { AlertTriangle } from "lucide-react"

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

interface UnplacedAnswersModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  /** 置き場が無くアップロードされない答案の表示名 */
  unplacedFileNames: string[]
  /** 実際にアップロードされる答案の件数 */
  placedCount: number
}

// 一覧が長くなりすぎないよう先頭のみ挙げ、残りは件数で示す
const NAME_PREVIEW_LIMIT = 10

/**
 * 表の空きマスより答案が多いときの確認モーダル。
 *
 * 自動配置は有効マスの数までしか行わないため、あふれた答案はアップロードされないまま
 * 送信後に破棄される（仕様）。黙って消えると気づけないので、送信前にどの答案が
 * 対象外になるかを示して続行するかを選ばせる。
 */
export function UnplacedAnswersModal({
  isOpen,
  onClose,
  onConfirm,
  unplacedFileNames,
  placedCount,
}: UnplacedAnswersModalProps) {
  const previewNames = unplacedFileNames.slice(0, NAME_PREVIEW_LIMIT)
  const hiddenCount = unplacedFileNames.length - previewNames.length

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            置き場のない答案があります
          </AlertDialogTitle>
          <AlertDialogDescription>
            表の空きマスより答案が多いため、
            {unplacedFileNames.length}件はどのマスにも配置されていません。
            このまま実行すると、配置済みの{placedCount}
            件だけがアップロードされ、残りは破棄されます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div className="rounded bg-amber-50 p-3 text-amber-900">
            <p className="text-sm font-medium">
              アップロードされない答案（{unplacedFileNames.length}件）
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
              {previewNames.map((fileName) => (
                <li key={fileName} className="truncate">
                  {fileName}
                </li>
              ))}
              {hiddenCount > 0 && <li>ほか{hiddenCount}件</li>}
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            全て取り込むには、キャンセルして受験生徒か模範解答のページを増やすか、
            答案を分けてアップロードしてください。
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>
            配置済みの{placedCount}件をアップロード
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
