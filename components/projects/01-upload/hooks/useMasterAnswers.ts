"use client"

import { ConvertedImage } from "@/lib/pdfConverter"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { MasterAnswer, MasterAnswersState } from "@/components/projects/01-upload/types"
import {
  createUploadData,
  generateImageUrls,
  generatePageNumberUpdateRequests,
  generateUploadSuccessMessage,
  moveImageInList,
  sortImagesByPageNumber,
} from "../utils/image-utils"
import {
  clearPasswordGlobals,
  convertPdfWithPassword,
  createClosedPasswordDialogState,
  createPasswordDialogState,
  createPasswordErrorState,
  createPasswordLoadingState,
  getPasswordGlobals,
  setPasswordGlobals,
} from "../utils/password-utils"

/**
 * マスター解答管理フック
 * @param {string} projectId - プロジェクトID
 * @param {MasterAnswer[]} initialAnswers - 初期解答リスト
 * @param {function} onAnswersChange - 解答変更時のコールバック
 * @returns {object} マスター解答管理の状態と操作関数
 */
export function useMasterAnswers(
  projectId: string,
  initialAnswers: MasterAnswer[],
  onAnswersChange: (answers: MasterAnswer[]) => void,
) {
  // 状態管理
  const [state, setState] = useState<MasterAnswersState>({
    answers: [],
    imageUrls: {},
    isUploading: false,
    uploadProgress: 0,
    isDeleting: {},
    isMoving: false,
    passwordDialog: createClosedPasswordDialogState(),
  })

  // パスワード処理用の状態（削除済み - 未使用のため）

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
   * パスワード付きPDF変換処理
   * @param {File} file - 変換対象のPDFファイル
   * @returns {Promise<ConvertedImage[]>} 変換された画像データ
   */
  const convertPdfToImagesWithPassword = useCallback(
    async (file: File): Promise<ConvertedImage[]> => {
      try {
        // まずパスワードなしで試行
        return await convertPdfWithPassword(file)
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)

        if (
          errorMessage === "password-required" ||
          errorMessage === "invalid-password"
        ) {
          // パスワードが必要な場合、ダイアログを表示してPromiseを返す
          return new Promise((resolve, reject) => {
            const isInvalidPassword = errorMessage === "invalid-password"
            const dialogState = createPasswordDialogState(
              file.name,
              isInvalidPassword,
              state.passwordDialog.attempts,
            )

            setState((prev) => ({
              ...prev,
              passwordDialog: dialogState,
            }))

            // グローバルスコープで解決関数を保存
            setPasswordGlobals(resolve, reject, file)
          })
        } else {
          // その他のエラーはそのまま投げる
          throw error
        }
      }
    },
    [state.passwordDialog.attempts],
  )

  /**
   * 画像アップロード処理
   * @param {File[]} files - アップロード対象のファイルリスト
   */
  const uploadAnswers = useCallback(
    async (files: File[]) => {
      if (!projectId) {
        toast.error("プロジェクトIDが指定されていません。")
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
            try {
              // Convert PDF to individual page images with password handling
              const pdfImages = await convertPdfToImagesWithPassword(file)
              allFilesData.push(...pdfImages)
            } catch (error) {
              if (
                error instanceof Error &&
                error.message === "Password input cancelled"
              ) {
                // ユーザーがパスワード入力をキャンセルした場合
                return // アップロード処理を中断
              } else {
                throw error // その他のエラーは再投げ
              }
            }
          } else {
            // Handle regular image files
            const imageData = await createUploadData(file)
            allFilesData.push(...imageData)
          }
        }

        const result = await window.electronAPI.uploadMasterAnswers(
          projectId,
          allFilesData,
        )

        if (result) {
          const totalPages = allFilesData.length
          const pdfCount = files.filter(
            (f) => f.type === "application/pdf",
          ).length
          const imageCount = files.length - pdfCount

          const message = generateUploadSuccessMessage(
            totalPages,
            pdfCount,
            imageCount,
          )
          toast.success(message)

          // Get updated project data
          const updatedProject =
            await window.electronAPI.fetchProjectById(projectId)
          if (updatedProject && updatedProject.projectPages) {
            // Convert projectPages to master answers format for compatibility
            const masterAnswers = updatedProject.projectPages
              .filter((page) =>
                page.pageImages?.some((img) => img.imageType === "MODEL_ANSWER"),
              )
              .map((page) => {
                const masterAnswer = page.pageImages?.find(
                  (img) => img.imageType === "MODEL_ANSWER",
                )
                return {
                  id: page.id,
                  projectId: page.projectId,
                  imagePath: masterAnswer?.imagePath || "",
                  pageNumber: page.pageNumber,
                  createdAt: page.createdAt,
                  updatedAt: page.updatedAt,
                }
              })
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
    [projectId, onAnswersChange, convertPdfToImagesWithPassword],
  )

  /**
   * パスワード送信処理
   * @param {string} password - 入力されたパスワード
   */
  const handlePasswordSubmit = useCallback(async (password: string) => {
    const { resolve, reject, file } = getPasswordGlobals()

    if (!file || !resolve || !reject) {
      return
    }

    setState((prev) => ({
      ...prev,
      passwordDialog: createPasswordLoadingState(prev.passwordDialog),
    }))

    try {
      const pdfImages = await convertPdfWithPassword(file, password)

      // パスワード成功時の処理
      setState((prev) => ({
        ...prev,
        passwordDialog: createClosedPasswordDialogState(),
      }))

      clearPasswordGlobals()
      resolve(pdfImages)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (errorMessage === "invalid-password") {
        setState((prev) => ({
          ...prev,
          passwordDialog: createPasswordErrorState(prev.passwordDialog),
        }))
      } else {
        setState((prev) => ({
          ...prev,
          passwordDialog: createClosedPasswordDialogState(),
        }))

        clearPasswordGlobals()
        reject(error)
      }
    }
  }, [])

  /**
   * パスワードダイアログキャンセル処理
   */
  const handlePasswordCancel = useCallback(() => {
    const { reject } = getPasswordGlobals()

    setState((prev) => ({
      ...prev,
      passwordDialog: createClosedPasswordDialogState(),
      isUploading: false,
    }))

    clearPasswordGlobals()

    // Promise を拒否
    if (reject) {
      reject(new Error("Password input cancelled"))
    }
  }, [])

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
        await window.electronAPI.deleteMasterAnswer(answerId)
        const updatedAnswers = state.answers.filter((answer) => answer.id !== answerId)

        setState((prev) => ({
          ...prev,
          answers: updatedAnswers,
          isDeleting: { ...prev.isDeleting, [answerId]: false },
          imageUrls: Object.fromEntries(
            Object.entries(prev.imageUrls).filter(([id]) => id !== answerId),
          ),
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
    [state.answers, onAnswersChange],
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
    [state.answers, onAnswersChange],
  )

  return {
    ...state,
    uploadAnswers,
    deleteAnswer,
    moveAnswer,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}
