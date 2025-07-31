"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { FileUp, Loader2, Upload, X } from "lucide-react"
import React, { useCallback, useRef, useState } from "react"
import type { FileUploadDropzoneProps } from "../types"
import { isValidMasterImageFile } from "../utils/file-validation"

/**
 * FileUploadDropzone - ファイルアップロード用ドラッグ&ドロップエリアコンポーネント
 * 
 * 機能:
 * - ドラッグ&ドロップによるファイルアップロード
 * - クリックによるファイル選択
 * - PDF・画像ファイルの検証
 * - アップロード進捗表示
 * - 複数ファイル対応
 * 
 * @param onFilesSelected - ファイル選択時のコールバック関数
 * @param isUploading - アップロード中かどうか
 * @param uploadProgress - アップロード進捗（0-100）
 * @param accept - 受け入れ可能なファイル形式
 * @param maxFileSize - 最大ファイルサイズ（バイト）
 * @param disabled - 無効化状態
 * @returns ファイルアップロードドロップゾーンコンポーネント
 */
export function FileUploadDropzone({
  onFilesSelected,
  isUploading = false,
  uploadProgress = 0,
  accept = ".pdf,.png,.jpg,.jpeg",
  maxFileSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
}: FileUploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * ファイル検証処理
   * @param files - 検証対象のファイルリスト
   * @returns 検証結果（エラーメッセージまたはnull）
   */
  const validateFiles = useCallback((files: FileList): string | null => {
    const fileArray = Array.from(files)
    
    // ファイル数制限
    if (fileArray.length > 20) {
      return "一度にアップロードできるファイル数は20個までです。"
    }

    // 各ファイルの検証
    for (const file of fileArray) {
      // ファイル形式チェック
      if (!isValidMasterImageFile(file)) {
        return `対応していないファイル形式です: ${file.name}\n対応形式: PDF, PNG, JPG, JPEG`
      }

      // ファイルサイズチェック
      if (file.size > maxFileSize) {
        const maxSizeMB = Math.round(maxFileSize / (1024 * 1024))
        return `ファイルサイズが大きすぎます: ${file.name}\n最大サイズ: ${maxSizeMB}MB`
      }
    }

    return null
  }, [maxFileSize])

  /**
   * ファイル選択処理
   * @param files - 選択されたファイルリスト
   */
  const handleFileSelection = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return

    setValidationError(null)

    // ファイル検証
    const error = validateFiles(files)
    if (error) {
      setValidationError(error)
      return
    }

    // コールバック実行
    onFilesSelected(Array.from(files))
  }, [validateFiles, onFilesSelected])

  /**
   * ドラッグオーバー処理
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !isUploading) {
      setIsDragOver(true)
    }
  }, [disabled, isUploading])

  /**
   * ドラッグリーブ処理
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  /**
   * ドロップ処理
   */
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    if (disabled || isUploading) return

    const files = e.dataTransfer.files
    handleFileSelection(files)
  }, [disabled, isUploading, handleFileSelection])

  /**
   * ファイル選択ボタンクリック処理
   */
  const handleFileButtonClick = useCallback(() => {
    if (disabled || isUploading) return
    fileInputRef.current?.click()
  }, [disabled, isUploading])

  /**
   * ファイル入力変更処理
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(e.target.files)
    // ファイル入力をリセット（同じファイルを再選択可能にする）
    e.target.value = ""
  }, [handleFileSelection])

  /**
   * エラー削除処理
   */
  const handleClearError = useCallback(() => {
    setValidationError(null)
  }, [])

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
            ${isDragOver && !disabled && !isUploading 
              ? "border-blue-400 bg-blue-50" 
              : "border-gray-300 hover:border-gray-400"
            }
            ${disabled || isUploading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleFileButtonClick}
        >
          {/* アップロード中表示 */}
          {isUploading && (
            <div className="space-y-4">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
              <div className="space-y-2">
                <p className="text-sm font-medium">アップロード中...</p>
                <Progress value={uploadProgress} className="w-full" />
                <p className="text-xs text-gray-500">{uploadProgress}%</p>
              </div>
            </div>
          )}

          {/* 通常状態 */}
          {!isUploading && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-2">
                {isDragOver ? (
                  <FileUp className="h-12 w-12 text-blue-600" />
                ) : (
                  <Upload className="h-12 w-12 text-gray-400" />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {isDragOver 
                      ? "ファイルをドロップしてください" 
                      : "ファイルをドラッグ&ドロップまたはクリックして選択"
                    }
                  </p>
                  <p className="text-xs text-gray-500">
                    対応形式: PDF, PNG, JPG, JPEG（最大{Math.round(maxFileSize / (1024 * 1024))}MB）
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation()
                  handleFileButtonClick()
                }}
              >
                ファイルを選択
              </Button>
            </div>
          )}

          {/* 隠しファイル入力 */}
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            className="hidden"
            onChange={handleFileInputChange}
            disabled={disabled || isUploading}
          />
        </div>

        {/* エラー表示 */}
        {validationError && (
          <div className="mt-4 flex items-start space-x-2 rounded-md border border-red-200 bg-red-50 p-3">
            <div className="flex-1">
              <p className="text-sm text-red-800 whitespace-pre-line">
                {validationError}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearError}
              className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}