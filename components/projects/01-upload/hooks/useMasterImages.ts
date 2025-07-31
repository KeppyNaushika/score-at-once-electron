"use client"

import { ConvertedImage } from "@/lib/pdfConverter"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { MasterImage, MasterImagesState } from "@/components/projects/01-upload/types"
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
 * マスター画像管理フック
 * @param {string} projectId - プロジェクトID
 * @param {MasterImage[]} initialImages - 初期画像リスト
 * @param {function} onImagesChange - 画像変更時のコールバック
 * @returns {object} マスター画像管理の状態と操作関数
 */
export function useMasterImages(
  projectId: string,
  initialImages: MasterImage[],
  onImagesChange: (images: MasterImage[]) => void,
) {
  // 状態管理
  const [state, setState] = useState<MasterImagesState>({
    images: [],
    imageUrls: {},
    isUploading: false,
    uploadProgress: 0,
    isDeleting: {},
    isMoving: false,
    passwordDialog: createClosedPasswordDialogState(),
  })

  // パスワード処理用の状態（削除済み - 未使用のため）

  /**
   * 初期画像とURLの設定
   */
  useEffect(() => {
    const sortedImages = sortImagesByPageNumber(initialImages)
    setState((prev) => ({ ...prev, images: sortedImages }))

    const fetchUrls = async () => {
      if (sortedImages.length > 0) {
        const urls = await generateImageUrls(sortedImages)
        setState((prev) => ({ ...prev, imageUrls: urls }))
      } else {
        setState((prev) => ({ ...prev, imageUrls: {} }))
      }
    }

    fetchUrls()
  }, [initialImages])

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
  const uploadImages = useCallback(
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

        const result = await window.electronAPI.uploadMasterImages(
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
            // Convert projectPages to master images format for compatibility
            const masterImages = updatedProject.projectPages
              .filter((page) =>
                page.pageImages?.some((img) => img.imageType === "MASTER"),
              )
              .map((page) => {
                const masterImage = page.pageImages?.find(
                  (img) => img.imageType === "MASTER",
                )
                return {
                  id: page.id,
                  projectId: page.projectId,
                  imagePath: masterImage?.imagePath || "",
                  pageNumber: page.pageNumber,
                  createdAt: page.createdAt,
                  updatedAt: page.updatedAt,
                }
              })
            const sortedUpdatedImages = sortImagesByPageNumber(masterImages)

            setState((prev) => ({ ...prev, images: sortedUpdatedImages }))
            onImagesChange(sortedUpdatedImages)

            // Update image URLs
            const newUrls = await generateImageUrls(sortedUpdatedImages)
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
    [projectId, onImagesChange, convertPdfToImagesWithPassword],
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
  const deleteImage = useCallback(
    async (imageId: string) => {
      setState((prev) => ({
        ...prev,
        isDeleting: { ...prev.isDeleting, [imageId]: true },
      }))

      try {
        await window.electronAPI.deleteMasterImage(imageId)
        const updatedImages = state.images.filter((img) => img.id !== imageId)

        setState((prev) => ({
          ...prev,
          images: updatedImages,
          isDeleting: { ...prev.isDeleting, [imageId]: false },
          imageUrls: Object.fromEntries(
            Object.entries(prev.imageUrls).filter(([id]) => id !== imageId),
          ),
        }))

        onImagesChange(updatedImages)
        toast.success("画像を削除しました。")
      } catch (error) {
        console.error("Failed to delete image:", error)
        toast.error("画像の削除に失敗しました。")
        setState((prev) => ({
          ...prev,
          isDeleting: { ...prev.isDeleting, [imageId]: false },
        }))
      }
    },
    [state.images, onImagesChange],
  )

  /**
   * 画像移動処理
   * @param {number} fromIndex - 移動元のインデックス
   * @param {"left" | "right"} direction - 移動方向
   */
  const moveImage = useCallback(
    async (fromIndex: number, direction: "left" | "right") => {
      const newImages = moveImageInList(state.images, fromIndex, direction)
      if (!newImages) return

      setState((prev) => ({ ...prev, isMoving: true }))

      try {
        const updateRequests = generatePageNumberUpdateRequests(newImages)
        await window.electronAPI.updateMasterImagesOrder(updateRequests)

        setState((prev) => ({ ...prev, images: newImages }))
        onImagesChange(newImages)
      } catch (error) {
        console.error("Failed to move image:", error)
        toast.error("画像の移動に失敗しました。")
      } finally {
        setState((prev) => ({ ...prev, isMoving: false }))
      }
    },
    [state.images, onImagesChange],
  )

  return {
    ...state,
    uploadImages,
    deleteImage,
    moveImage,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}
