"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

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
import type { StudentAnswerScoreSummary } from "@/electron-src/lib/prisma/studentAnswer/crud"

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  /** 採点データの照会に使う StudentAnswerImage.id */
  fileId: string
  studentName?: string
  pageNumber?: number
}

/** 採点データの内訳を「◯◯ 3件」形式の行に整形する（0件は出さない） */
function buildScoreDetails(summary: StudentAnswerScoreSummary): string[] {
  const details: string[] = []
  if (summary.scoredQuestionCount > 0) {
    details.push(`採点済みの設問: ${summary.scoredQuestionCount}問`)
  }
  if (summary.scoreDecisionCount > 0) {
    details.push(`確定した点数: ${summary.scoreDecisionCount}件`)
  }
  if (summary.drawingAnnotationCount > 0) {
    details.push(`答案への書き込み: ${summary.drawingAnnotationCount}件`)
  }
  if (summary.scoredCompoundAnswerCount > 0) {
    details.push(`採点済みの複合回答: ${summary.scoredCompoundAnswerCount}問`)
  }
  return details
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  fileId,
  studentName,
  pageNumber,
}: DeleteConfirmationModalProps) {
  const [summary, setSummary] = useState<StudentAnswerScoreSummary | null>(null)
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)

  // 開いたときだけ照会する（全マス分を先読みすると採点データ量に比例して重くなる）。
  // async 関数内で完結させ、preload が古い等で同期例外が飛んでも loading を必ず解除する。
  useEffect(() => {
    if (!isOpen) return

    let isCurrent = true
    setIsLoadingSummary(true)
    setSummaryError(null)
    setSummary(null)

    const loadSummary = async () => {
      try {
        const result =
          await window.electronAPI.getStudentAnswerScoreSummary(fileId)
        if (!isCurrent) return
        if (result.success) {
          setSummary(result.summary)
        } else {
          setSummaryError(result.error ?? "採点データの確認に失敗しました")
        }
      } catch (error) {
        if (!isCurrent) return
        console.error("採点データ照会エラー:", error)
        setSummaryError("採点データの確認に失敗しました")
      } finally {
        if (isCurrent) setIsLoadingSummary(false)
      }
    }

    void loadSummary()

    return () => {
      isCurrent = false
    }
  }, [isOpen, fileId])

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const scoreDetails = summary ? buildScoreDetails(summary) : []

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
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
              {isLoadingSummary && (
                <li className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  採点データを確認しています…
                </li>
              )}
              {/* 照会に失敗したら「採点データは無い」と誤解させないよう、
                  安全側に倒して無条件の警告を出す */}
              {summaryError && (
                <>
                  <li>{summaryError}</li>
                  <li className="font-medium">
                    この答案に採点データがあれば全て削除されます
                  </li>
                </>
              )}
              {summary?.hasScoreData && (
                <li className="font-medium">
                  この答案の採点データも全て削除されます
                  <ul className="mt-1 list-inside list-[circle] space-y-0.5 pl-4 font-normal">
                    {scoreDetails.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                </li>
              )}
              {summary && !summary.hasScoreData && (
                <li>この答案にはまだ採点データがありません</li>
              )}
            </ul>
          </div>

          <p className="text-sm text-gray-600">
            本当に削除してもよろしいですか？
          </p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>キャンセル</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoadingSummary}
            className="bg-red-600 hover:bg-red-700"
          >
            削除する
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
