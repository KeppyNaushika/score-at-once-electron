"use client"

import { useMutation, useQueries, useQuery } from "@tanstack/react-query"
import { useCallback, useMemo, useState } from "react"
import { toast } from "sonner"

import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import type { ConvertedImage } from "@/lib/pdfConverter"
import {
  deleteMasterAnswerMutation,
  examPagesQuery,
  replaceMasterAnswerImageMutation,
  updateExamPagePageSizeMutation,
  updateMasterAnswersOrderMutation,
  uploadMasterAnswersMutation,
} from "@/queries/exam"
import { fileProtocolPathQuery } from "@/queries/misc"

import {
  createUploadData,
  generatePageNumberUpdateRequests,
  generateUploadSuccessMessage,
  moveImageInList,
  sortImagesByPageNumber,
} from "../utils/imageUtils"

/** 未取得のときに毎回新しい配列を作らないための空値 */
const EMPTY_PAGES: ExamPageWithContent[] = []

/**
 * 模範解答ページの管理フック
 *
 * 模範解答ページは ExamPage そのもの。ここで扱う id はすべて ExamPage.id である。
 *
 * @param examId - 試験ID
 */
export function useMasterAnswers(examId: string) {
  // PDF→PNG の変換は数秒かかる。ここを覆わないと無反応に見えて二重に投げ込める
  const [isConverting, setIsConverting] = useState(false)

  // パスワード保護PDFの変換は共通フックに委譲
  const {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = usePdfPasswordConversion()

  const { data: examPages = EMPTY_PAGES } = useQuery(examPagesQuery(examId))
  // 一覧はページ番号順に出す。並べ替えは表示のたびに行い、DB の順序は書き換えない
  const answers = useMemo(() => sortImagesByPageNumber(examPages), [examPages])

  const uploadMasterAnswers = useMutation(uploadMasterAnswersMutation(examId))
  const replaceMasterAnswerImage = useMutation(
    replaceMasterAnswerImageMutation(examId)
  )
  const deleteMasterAnswer = useMutation(deleteMasterAnswerMutation(examId))
  const updateMasterAnswersOrder = useMutation(
    updateMasterAnswersOrderMutation(examId)
  )
  const updateExamPagePageSize = useMutation(
    updateExamPagePageSizeMutation(examId)
  )

  // 画像の URL はページごとに引く。画像を持たないページは引かない
  const imageUrls = useQueries({
    queries: answers.map((answer) => ({
      ...fileProtocolPathQuery(answer.imagePath ?? ""),
      enabled: Boolean(answer.imagePath),
    })),
    combine: useCallback(
      (results: { data?: string }[]) =>
        Object.fromEntries(
          answers.map((answer, index) => [
            answer.id,
            answer.imagePath ? (results[index]?.data ?? "") : "",
          ])
        ),
      [answers]
    ),
  })

  /** File を main へ渡せる形（PDFは画像へ変換済み）にする。キャンセル時は null */
  const toUploadData = useCallback(
    async (file: File): Promise<ConvertedImage[] | null> => {
      if (file.type === "application/pdf") {
        const pdfConversion = await convertPdfWithRetry(file)
        if (pdfConversion === null) return null
        return pdfConversion.images
      }
      return await createUploadData(file)
    },
    [convertPdfWithRetry]
  )

  const uploadAnswers = useCallback(
    async (files: File[]) => {
      const allFilesData: ConvertedImage[] = []

      setIsConverting(true)
      try {
        for (const file of files) {
          const fileData = await toUploadData(file)
          // ユーザーがパスワード入力をキャンセルした場合はアップロードを中断
          if (fileData === null) return
          allFilesData.push(...fileData)
        }
      } finally {
        setIsConverting(false)
      }

      const pdfCount = files.filter(
        (file) => file.type === "application/pdf"
      ).length
      uploadMasterAnswers.mutate(allFilesData, {
        onSuccess: () =>
          toast.success(
            generateUploadSuccessMessage(
              allFilesData.length,
              pdfCount,
              files.length - pdfCount
            )
          ),
      })
    },
    [toUploadData, uploadMasterAnswers]
  )

  /**
   * 模範解答画像だけを差し替える。採点領域・答案・採点結果はそのまま残る。
   * 複数ページのPDFを渡された場合は1ページ目だけを使う（1ページ＝1枚のため）
   */
  const replaceAnswerImage = useCallback(
    async (examPageId: string, file: File) => {
      const fileData = await toUploadData(file)
      if (fileData === null) return
      if (fileData.length === 0) {
        toast.error("画像を読み取れませんでした。")
        return
      }
      if (fileData.length > 1) {
        toast.info(
          `複数ページのファイルです。1ページ目だけを差し替えに使います（残り${fileData.length - 1}ページは無視）。`
        )
      }

      replaceMasterAnswerImage.mutate(
        { examPageId, fileData: fileData[0] },
        { onSuccess: () => toast.success("模範解答画像を差し替えました。") }
      )
    },
    [replaceMasterAnswerImage, toUploadData]
  )

  /**
   * ページごと削除する。答案画像・採点結果もカスケード削除されるため、
   * 呼び出し側で確認を取ってから呼ぶこと
   */
  const deleteAnswer = useCallback(
    (examPageId: string) => {
      deleteMasterAnswer.mutate(examPageId, {
        onSuccess: () => toast.success("ページを削除しました。"),
      })
    },
    [deleteMasterAnswer]
  )

  const moveAnswer = useCallback(
    (fromIndex: number, direction: "left" | "right") => {
      const movedAnswers = moveImageInList(answers, fromIndex, direction)
      if (!movedAnswers) return

      updateMasterAnswersOrder.mutate(
        generatePageNumberUpdateRequests(movedAnswers)
      )
    },
    [answers, updateMasterAnswersOrder]
  )

  const updatePageSize = useCallback(
    (examPageId: string, pageSize: string) => {
      updateExamPagePageSize.mutate(
        { examPageId, pageSize },
        { onSuccess: () => toast.success("用紙サイズを変更しました") }
      )
    },
    [updateExamPagePageSize]
  )

  return {
    answers,
    imageUrls,
    isUploading: isConverting || uploadMasterAnswers.isPending,
    deletingAnswerId: deleteMasterAnswer.isPending
      ? (deleteMasterAnswer.variables ?? null)
      : null,
    replacingAnswerId: replaceMasterAnswerImage.isPending
      ? (replaceMasterAnswerImage.variables?.examPageId ?? null)
      : null,
    isMoving: updateMasterAnswersOrder.isPending,
    passwordDialog,
    uploadAnswers,
    replaceAnswerImage,
    deleteAnswer,
    moveAnswer,
    updatePageSize,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}
