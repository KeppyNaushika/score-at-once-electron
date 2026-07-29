"use client"

import { useCallback, useRef, useState } from "react"

import { type ConvertedImage, convertPdfToImages } from "@/lib/pdfConverter"

/** パスワード入力ダイアログの表示状態 */
interface PdfPasswordDialogState {
  isOpen: boolean
  fileName: string
  hasError: boolean
  isLoading: boolean
}

const CLOSED_DIALOG: PdfPasswordDialogState = {
  isOpen: false,
  fileName: "",
  hasError: false,
  isLoading: false,
}

/** 変換結果と、そのPDFがパスワード保護されていたかどうか */
interface PdfConversionOutcome {
  images: ConvertedImage[]
  passwordProtected: boolean
}

/**
 * パスワード保護PDFの変換を、パスワード入力ダイアログ付きで処理する共通フック。
 *
 * 模範解答アップロード・生徒解答アップロード・PDFツールなど、PDFを画像変換する
 * 複数の機能で共有する。パスワードなしでまず変換を試み、失敗したらダイアログを開いて
 * 正しいパスワードが入力されるか、キャンセルされるまでループする。
 *
 * 使い方:
 * ```tsx
 * const { passwordDialog, convertPdfWithRetry, handlePasswordSubmit, handlePasswordCancel } =
 *   usePdfPasswordConversion()
 *
 * const images = await convertPdfWithRetry(file) // null = キャンセル
 *
 * <PasswordDialog
 *   isOpen={passwordDialog.isOpen}
 *   onClose={handlePasswordCancel}
 *   onSubmit={handlePasswordSubmit}
 *   fileName={passwordDialog.fileName}
 *   error={passwordDialog.hasError ? "パスワードが正しくありません" : undefined}
 *   isLoading={passwordDialog.isLoading}
 *   isFirstAttempt={!passwordDialog.hasError}
 * />
 * ```
 */
export function usePdfPasswordConversion() {
  const [passwordDialog, setPasswordDialog] =
    useState<PdfPasswordDialogState>(CLOSED_DIALOG)

  // 現在パスワード入力待ちのPromiseに対する応答関数を保持する。
  // ダイアログのsubmit/cancelとPromiseのresolveをグローバルなしでつなぐためにrefでつなぐ。
  const submitRef = useRef<((password: string) => void) | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)

  const handlePasswordSubmit = useCallback((password: string) => {
    submitRef.current?.(password)
  }, [])

  const handlePasswordCancel = useCallback(() => {
    cancelRef.current?.()
  }, [])

  /**
   * パスワード付きPDFを画像へ変換する（リトライ対応）。
   * @param file 変換対象のPDFファイル
   * @returns 変換画像とパスワード保護有無。ユーザーがパスワード入力をキャンセルした場合は null。
   * @throws パスワード以外の理由で変換に失敗した場合
   */
  const convertPdfWithRetry = useCallback(
    async (file: File): Promise<PdfConversionOutcome | null> => {
      let hasError = false

      // まずパスワードなしで試行
      try {
        const images = await convertPdfToImages(file)
        return { images, passwordProtected: false }
      } catch (error) {
        if (
          !(error instanceof Error) ||
          error.message !== "password-required"
        ) {
          // パスワード以外のエラーは呼び出し元に委ねる
          throw error
        }
      }

      // パスワード入力ループ（キャンセルまたは成功まで）
      while (true) {
        const password = await new Promise<string | null>((resolve) => {
          submitRef.current = (pwd) => {
            setPasswordDialog((prev) => ({
              ...prev,
              isLoading: true,
              hasError: false,
            }))
            resolve(pwd)
          }
          cancelRef.current = () => {
            setPasswordDialog(CLOSED_DIALOG)
            resolve(null)
          }
          setPasswordDialog({
            isOpen: true,
            fileName: file.name,
            hasError,
            isLoading: false,
          })
        })

        // 応答関数を片付ける
        submitRef.current = null
        cancelRef.current = null

        if (password === null) {
          // キャンセルされた
          return null
        }

        try {
          const images = await convertPdfToImages(file, password)
          setPasswordDialog(CLOSED_DIALOG)
          return { images, passwordProtected: true }
        } catch (retryError) {
          if (
            retryError instanceof Error &&
            (retryError.message === "password-required" ||
              retryError.message === "invalid-password")
          ) {
            // パスワードが間違っている → 再入力を促す
            hasError = true
            continue
          }
          // その他のエラーはダイアログを閉じて呼び出し元に委ねる
          setPasswordDialog(CLOSED_DIALOG)
          throw retryError
        }
      }
    },
    []
  )

  return {
    passwordDialog,
    convertPdfWithRetry,
    handlePasswordSubmit,
    handlePasswordCancel,
  }
}
