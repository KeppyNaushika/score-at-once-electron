"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import {
  MasterAnswer,
  MasterAnswersState,
} from "@/components/exams/01-upload/types"
import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import { ConvertedImage } from "@/lib/pdfConverter"

import {
  convertExamPagesToMasterAnswers,
  createUploadData,
  generateImageUrls,
  generatePageNumberUpdateRequests,
  generateUploadSuccessMessage,
  moveImageInList,
  sortImagesByPageNumber,
} from "../utils/imageUtils"

/**
 * マスター解答管理フック
 * @param {string} examId - 試験ID
 * @param {MasterAnswer[]} initialAnswers - 初期解答リスト
 * @param {function} onAnswersChange - 解答変更時のコールバック
 * @returns {object} マスター解答管理の状態と操作関数
 */
export function useMasterAnswers(
  examId: string,
  initialAnswers: MasterAnswer[],
  onAnswersChange: (answers: MasterAnswer[]) => void
) {
  // 状態管理
  const [state, setState] = useState<MasterAnswersState>({
    answers: [],
    imageUrls: {},
    isUploading: false,
    uploadProgress: 0,
    isDeleting: {},
    isMoving: false,
  })

  // パスワード保護PDFの変換は共通フックに委譲
  const {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  } = usePdfPasswordConversion()

  /**
   * 初期解答とURLの設定
   */
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
   * 画像アップロード処理
   * @param {File[]} files - アップロード対象のファイルリスト
   */
  const uploadAnswers = useCallback(
    async (files: File[]) => {
      if (!examId) {
        toast.error("試験IDが指定されていません。")
        return
      }

      // クライアントサイドチェック
      if (typeof window === "undefined") {
        toast.error("この機能はクライアントサイドでのみ利用可能です。")
        return
      }

      setState((prev) => ({ ...prev, isUploading: true }))

      try {
        const allFilesData: ConvertedImage[] = []

        for (let i = 0; i < files.length; i++) {
          const file = files[i]

          if (file.type === "application/pdf") {
            // Convert PDF to individual page images with password handling
            const pdfImages = await convertPdfWithRetry(file)
            if (pdfImages === null) {
              // ユーザーがパスワード入力をキャンセルした場合はアップロードを中断
              return
            }
            allFilesData.push(...pdfImages)
          } else {
            // Handle regular image files
            const imageData = await createUploadData(file)
            allFilesData.push(...imageData)
          }
        }

        const result = await window.electronAPI.uploadMasterAnswers(
          examId,
          allFilesData
        )

        if (result) {
          const totalPages = allFilesData.length
          const pdfCount = files.filter(
            (file) => file.type === "application/pdf"
          ).length
          const imageCount = files.length - pdfCount

          const message = generateUploadSuccessMessage(
            totalPages,
            pdfCount,
            imageCount
          )
          toast.success(message)

          // Get updated exam pages (masterImages を含む軽量クエリ)
          const updatedPages =
            await window.electronAPI.getExamPagesByExamId(examId)
          if (updatedPages && updatedPages.length > 0) {
            const masterAnswers = convertExamPagesToMasterAnswers(updatedPages)
            const sortedUpdatedAnswers = sortImagesByPageNumber(masterAnswers)

            setState((prev) => ({ ...prev, answers: sortedUpdatedAnswers }))
            onAnswersChange(sortedUpdatedAnswers)

            // Update answer URLs
            const newUrls = await generateImageUrls(sortedUpdatedAnswers)
            setState((prev) => ({ ...prev, imageUrls: newUrls }))
          }
        }
      } catch (error) {
        console.error("Upload failed:", error)
        toast.error("ファイルのアップロードに失敗しました。")
      } finally {
        setState((prev) => ({ ...prev, isUploading: false }))
      }
    },
    [examId, onAnswersChange, convertPdfWithRetry]
  )

  /**
   * 画像削除処理
   * @param {string} imageId - 削除対象の画像ID
   */
  const deleteAnswer = useCallback(
    async (answerId: string) => {
      setState((prev) => ({
        ...prev,
        isDeleting: { ...prev.isDeleting, [answerId]: true },
      }))

      try {
        const result = await window.electronAPI.deleteMasterAnswer(answerId)
        const updatedAnswers = sortImagesByPageNumber(
          convertExamPagesToMasterAnswers(result.examPages)
        )
        const newUrls = await generateImageUrls(updatedAnswers)

        setState((prev) => ({
          ...prev,
          answers: updatedAnswers,
          isDeleting: { ...prev.isDeleting, [answerId]: false },
          imageUrls: newUrls,
        }))

        onAnswersChange(updatedAnswers)
        toast.success("画像を削除しました。")
      } catch (error) {
        console.error("Failed to delete image:", error)
        toast.error("画像の削除に失敗しました。")
        setState((prev) => ({
          ...prev,
          isDeleting: { ...prev.isDeleting, [answerId]: false },
        }))
      }
    },
    [onAnswersChange]
  )

  /**
   * 解答移動処理
   * @param {number} fromIndex - 移動元のインデックス
   * @param {"left" | "right"} direction - 移動方向
   */
  const moveAnswer = useCallback(
    async (fromIndex: number, direction: "left" | "right") => {
      const newAnswers = moveImageInList(state.answers, fromIndex, direction)
      if (!newAnswers) return

      setState((prev) => ({ ...prev, isMoving: true }))

      try {
        const updateRequests = generatePageNumberUpdateRequests(newAnswers)
        await window.electronAPI.updateMasterAnswersOrder(updateRequests)

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
    async (answerId: string, pageSize: string) => {
      try {
        await window.electronAPI.updateMasterImagePageSize(answerId, pageSize)
        setState((prev) => ({
          ...prev,
          answers: prev.answers.map((answer) =>
            answer.id === answerId ? { ...answer, pageSize } : answer
          ),
        }))
        onAnswersChange(
          state.answers.map((answer) =>
            answer.id === answerId ? { ...answer, pageSize } : answer
          )
        )
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
    deleteAnswer,
    moveAnswer,
    updatePageSize,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}
