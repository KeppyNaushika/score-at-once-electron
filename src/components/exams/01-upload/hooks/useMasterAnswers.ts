"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { MasterAnswersState } from "@/components/exams/01-upload/types"
import type { ExamPageWithContent } from "@/electron-src/lib/prisma/examPage"
import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import { ConvertedImage } from "@/lib/pdfConverter"

import {
  createUploadData,
  generateImageUrls,
  generatePageNumberUpdateRequests,
  generateUploadSuccessMessage,
  moveImageInList,
  sortImagesByPageNumber,
} from "../utils/imageUtils"

/**
 * 模範解答ページの管理フック
 *
 * 模範解答ページは ExamPage そのもの。ここで扱う id はすべて ExamPage.id である。
 *
 * @param examId - 試験ID
 * @param initialAnswers - 初期ページリスト
 * @param onAnswersChange - 変更時のコールバック
 */
export function useMasterAnswers(
  examId: string,
  initialAnswers: ExamPageWithContent[],
  onAnswersChange: (answers: ExamPageWithContent[]) => void
) {
  const [state, setState] = useState<MasterAnswersState>({
    answers: [],
    imageUrls: {},
    isUploading: false,
    uploadProgress: 0,
    isDeleting: {},
    isReplacing: {},
    isMoving: false,
  })

  // パスワード保護PDFの変換は共通フックに委譲
  const {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = usePdfPasswordConversion()

  useEffect(() => {
    const sortedAnswers = sortImagesByPageNumber(initialAnswers)
    setState((prev) => ({ ...prev, answers: sortedAnswers }))

    const fetchUrls = async () => {
      if (sortedAnswers.length > 0) {
        const urls = await generateImageUrls(sortedAnswers)
        setState((prev) => ({ ...prev, imageUrls: urls }))
      } else {
        setState((prev) => ({ ...prev, imageUrls: {} }))
      }
    }

    fetchUrls()
  }, [initialAnswers])

  /**
   * DBを引き直して一覧と画像URLを差し替える。
   * ページ番号の振り直しや答案のカスケード削除まで含めて、main 側の結果をそのまま反映する
   */
  const reloadAnswers = useCallback(async () => {
    const fetchedPages = await window.electronAPI.getExamPagesByExamId(examId)
    const sortedAnswers = sortImagesByPageNumber(fetchedPages ?? [])
    const urls = await generateImageUrls(sortedAnswers)

    setState((prev) => ({ ...prev, answers: sortedAnswers, imageUrls: urls }))
    onAnswersChange(sortedAnswers)
    return sortedAnswers
  }, [examId, onAnswersChange])

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
      if (!examId) {
        toast.error("試験IDが指定されていません。")
        return
      }

      setState((prev) => ({ ...prev, isUploading: true }))

      try {
        const allFilesData: ConvertedImage[] = []

        for (const file of files) {
          const fileData = await toUploadData(file)
          // ユーザーがパスワード入力をキャンセルした場合はアップロードを中断
          if (fileData === null) return
          allFilesData.push(...fileData)
        }

        const result = await window.electronAPI.uploadMasterAnswers(
          examId,
          allFilesData
        )

        if (result) {
          const pdfCount = files.filter(
            (file) => file.type === "application/pdf"
          ).length
          toast.success(
            generateUploadSuccessMessage(
              allFilesData.length,
              pdfCount,
              files.length - pdfCount
            )
          )
          await reloadAnswers()
        }
      } catch (error) {
        console.error("Upload failed:", error)
        toast.error("ファイルのアップロードに失敗しました。")
      } finally {
        setState((prev) => ({ ...prev, isUploading: false }))
      }
    },
    [examId, toUploadData, reloadAnswers]
  )

  /**
   * 模範解答画像だけを差し替える。採点領域・答案・採点結果はそのまま残る。
   * 複数ページのPDFを渡された場合は1ページ目だけを使う（1ページ＝1枚のため）
   */
  const replaceAnswerImage = useCallback(
    async (examPageId: string, file: File) => {
      setState((prev) => ({
        ...prev,
        isReplacing: { ...prev.isReplacing, [examPageId]: true },
      }))

      try {
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

        await window.electronAPI.replaceMasterAnswerImage(
          examPageId,
          fileData[0]
        )
        await reloadAnswers()
        toast.success("模範解答画像を差し替えました。")
      } catch (error) {
        console.error("Failed to replace master answer image:", error)
        toast.error("模範解答画像の差し替えに失敗しました。")
      } finally {
        setState((prev) => ({
          ...prev,
          isReplacing: { ...prev.isReplacing, [examPageId]: false },
        }))
      }
    },
    [toUploadData, reloadAnswers]
  )

  /**
   * ページごと削除する。答案画像・採点結果もカスケード削除されるため、
   * 呼び出し側で確認を取ってから呼ぶこと
   */
  const deleteAnswer = useCallback(
    async (examPageId: string) => {
      setState((prev) => ({
        ...prev,
        isDeleting: { ...prev.isDeleting, [examPageId]: true },
      }))

      try {
        await window.electronAPI.deleteMasterAnswer(examPageId)
        await reloadAnswers()
        toast.success("ページを削除しました。")
      } catch (error) {
        console.error("Failed to delete page:", error)
        toast.error("ページの削除に失敗しました。")
      } finally {
        setState((prev) => ({
          ...prev,
          isDeleting: { ...prev.isDeleting, [examPageId]: false },
        }))
      }
    },
    [reloadAnswers]
  )

  const moveAnswer = useCallback(
    async (fromIndex: number, direction: "left" | "right") => {
      const newAnswers = moveImageInList(state.answers, fromIndex, direction)
      if (!newAnswers) return

      setState((prev) => ({ ...prev, isMoving: true }))

      try {
        await window.electronAPI.updateMasterAnswersOrder(
          generatePageNumberUpdateRequests(newAnswers)
        )

        setState((prev) => ({ ...prev, answers: newAnswers }))
        onAnswersChange(newAnswers)
      } catch (error) {
        console.error("Failed to move image:", error)
        toast.error("解答の移動に失敗しました。")
      } finally {
        setState((prev) => ({ ...prev, isMoving: false }))
      }
    },
    [state.answers, onAnswersChange]
  )

  const updatePageSize = useCallback(
    async (examPageId: string, pageSize: string) => {
      try {
        await window.electronAPI.updateExamPagePageSize(examPageId, pageSize)
        const updatedAnswers = state.answers.map((answer) =>
          answer.id === examPageId ? { ...answer, pageSize } : answer
        )
        setState((prev) => ({ ...prev, answers: updatedAnswers }))
        onAnswersChange(updatedAnswers)
        toast.success("用紙サイズを変更しました")
      } catch (error) {
        console.error("Failed to update page size:", error)
        toast.error("用紙サイズの変更に失敗しました")
      }
    },
    [state.answers, onAnswersChange]
  )

  return {
    ...state,
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
