"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { Button } from "@/components/ui/button"
import { convertPdfToImages } from "@/lib/pdfConverter"
import { toast } from "sonner"
import { Upload } from "lucide-react"

// 新しいコンポーネントのインポート
import FileUploadZone from "./FileUploadZone"
import AnswerSheetTableGrid from "./AnswerSheetTableGrid"

// 新しい型・フックのインポート
import type { UnifiedStudent, UnifiedFile } from "@/types/answer-sheet.types"
import { convertToUnifiedStudent, convertToUnifiedFile } from "@/utils/answerSheetConverter"
import { useAnswerSheetGrid } from "@/hooks/useAnswerSheetGrid"

// ============================================================================
// Props定義
// ============================================================================

interface AnswerSheetUploadProps {
  projectId: string
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
    attendanceNumber?: number | null
    status?: "participating" | "expected" | "absent"
    customOrder?: number | null
  }>
  masterImageCount: number  // 🚨 模範解答のページ数
  onUploadComplete?: () => void
}

// ============================================================================
// ファイル変換用の型定義（一時的）
// ============================================================================

interface ConvertedFileTemp {
  id: string
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview?: string
  pageNumber: number
  isSelected: boolean
  originalFileName: string
  pageLabel?: string
}

// ============================================================================
// メインコンポーネント
// ============================================================================

export default function AnswerSheetUpload({
  projectId,
  students,
  masterImageCount,
  onUploadComplete,
}: AnswerSheetUploadProps) {
  // ============================================================================
  // State管理（ファイル処理用）
  // ============================================================================

  const [isConverting, setIsConverting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string>("")
  const [isPasswordProcessing, setIsPasswordProcessing] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isClient, setIsClient] = useState(false)

  // ============================================================================
  // グリッド管理フック
  // ============================================================================

  const {
    files,
    unifiedStudents,
    isUploading,
    uploadProgress,
    setFiles,
    addFiles,
    handleUpload,
    sortedStudents,
    placedFiles,
    unplacedFiles,
    totalFiles,
    placedCount,
  } = useAnswerSheetGrid({
    projectId,
    students,
    onUploadComplete,
  })

  // ============================================================================
  // ファイル変換処理
  // ============================================================================

  const convertFilesToImages = useCallback(
    async (fileList: File[], password?: string): Promise<ConvertedFileTemp[]> => {
      const convertedFiles: ConvertedFileTemp[] = []
      
      for (const file of fileList) {
        try {
          if (file.type === "application/pdf") {
            const images = await convertPdfToImages(file, password)
            for (let i = 0; i < images.length; i++) {
              // プレビューURL作成
              const blob = new Blob([images[i].buffer], { type: "image/png" })
              const preview = URL.createObjectURL(blob)
              
              convertedFiles.push({
                id: crypto.randomUUID(),
                name: `${file.name} - ページ ${i + 1}`,
                type: "image/png",
                size: file.size,
                buffer: images[i].buffer,
                preview,
                pageNumber: i + 1,
                isSelected: true,
                originalFileName: file.name,
                pageLabel: `ページ ${i + 1}`,
              })
            }
          } else if (file.type.startsWith("image/")) {
            const buffer = await file.arrayBuffer()
            // プレビューURL作成
            const blob = new Blob([buffer], { type: file.type })
            const preview = URL.createObjectURL(blob)
            
            convertedFiles.push({
              id: crypto.randomUUID(),
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview,
              pageNumber: 1, // 画像は1ページとして扱う
              isSelected: true,
              originalFileName: file.name,
              pageLabel: "ページ 1",
            })
          }
        } catch (error) {
          console.error(`Failed to convert file ${file.name}:`, error)
          if (error instanceof Error && error.message.includes("password")) {
            // パスワードエラーの場合
            throw error
          } else {
            toast.error(`ファイル ${file.name} の変換に失敗しました`)
          }
        }
      }
      
      return convertedFiles
    },
    []
  )

  // ============================================================================
  // ファイル処理
  // ============================================================================

  const processFiles = useCallback(
    async (fileList: File[], password?: string) => {
      setIsConverting(true)
      setPasswordError("")

      try {
        const convertedFiles = await convertFilesToImages(fileList, password)
        
        // ConvertedFileTemp → UnifiedFile に変換
        const unifiedFiles: UnifiedFile[] = convertedFiles.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          size: f.size,
          buffer: f.buffer,
          preview: f.preview,
          studentId: undefined, // 未配置
          pageNumber: f.pageNumber,
          isSelected: f.isSelected,
          originalFileName: f.originalFileName,
          pageLabel: f.pageLabel,
        }))

        // ファイルを追加
        addFiles(unifiedFiles)
        
        // 成功メッセージ
        toast.success(`${convertedFiles.length}件のファイルを追加しました`)
        
        // パスワードダイアログを閉じる
        setShowPasswordDialog(false)
        setCurrentPdfFile(null)
        setPendingFiles([])
        
      } catch (error) {
        console.error("File processing error:", error)
        
        if (error instanceof Error && error.message.includes("password")) {
          // パスワードが必要な場合
          setPasswordError("パスワードが間違っているか、必要です")
          setShowPasswordDialog(true)
          setCurrentPdfFile(fileList[0]) // 最初のファイルを設定
          setPendingFiles(fileList)
        } else {
          toast.error("ファイル処理に失敗しました")
        }
      } finally {
        setIsConverting(false)
        setIsPasswordProcessing(false)
      }
    },
    [addFiles, convertFilesToImages]
  )

  // ============================================================================
  // ドロップハンドラー
  // ============================================================================

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("サポートされていないファイル形式です")
        return
      }

      console.log("📁 ファイルドロップ:", {
        count: acceptedFiles.length,
        files: acceptedFiles.map(f => ({ name: f.name, type: f.type, size: f.size }))
      })

      processFiles(acceptedFiles)
    },
    [processFiles]
  )

  // ============================================================================
  // パスワード送信
  // ============================================================================

  const handlePasswordSubmit = useCallback(
    async (password: string) => {
      if (!currentPdfFile || pendingFiles.length === 0) {
        return
      }

      setIsPasswordProcessing(true)
      setPasswordError("")

      try {
        await processFiles(pendingFiles, password)
      } catch (error) {
        console.error("Password processing error:", error)
        setPasswordError("パスワードが間違っています")
      }
    },
    [currentPdfFile, pendingFiles, processFiles]
  )

  // ============================================================================
  // SSR対応
  // ============================================================================

  // クライアントサイドでのみレンダリング
  if (typeof window !== "undefined" && !isClient) {
    setIsClient(true)
  }

  // ============================================================================
  // レンダリング
  // ============================================================================

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* 🚨 模範解答が存在しない場合の警告表示 */}
      {masterImageCount === 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <Upload className="mx-auto h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold text-amber-800 mb-2">
                模範解答が登録されていません
              </h3>
              <p className="text-amber-700 mb-4">
                模範解答をアップロードしたページ以外は受け付けません。<br />
                まず模範解答をアップロードしてください。
              </p>
              <Button 
                onClick={() => window.location.href = `/projects/${projectId}/01-upload`}
                className="bg-amber-600 hover:bg-amber-700"
              >
                模範解答をアップロード
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ファイルアップロード（模範解答がない場合は無効化） */}
      <FileUploadZone
        onDrop={onDrop}
        isConverting={isConverting}
        isClient={isClient}
        disabled={masterImageCount === 0}
      />

      {/* 生徒と答案の対応管理（新しいTable Grid） */}
      <div className="flex-1 min-h-0">
        <AnswerSheetTableGrid
          projectId={projectId}
          students={unifiedStudents}
          files={files}
          masterImageCount={masterImageCount}
          onFilesChange={setFiles}
          onUpload={handleUpload}
          isUploading={isUploading}
        />
      </div>

      {/* プログレスバー */}
      {isUploading && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm">アップロード中...</span>
                <span className="text-muted-foreground text-sm">
                  {uploadProgress}%
                </span>
              </div>
              <Progress value={uploadProgress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* パスワード入力ダイアログ */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false)
          setCurrentPdfFile(null)
          setPasswordError("")
          setPendingFiles([])
        }}
        onSubmit={handlePasswordSubmit}
        fileName={currentPdfFile?.name || ""}
        error={passwordError}
        isLoading={isPasswordProcessing}
      />

      {/* デバッグ情報（開発時のみ） */}
      {process.env.NODE_ENV === "development" && (
        <Card className="bg-gray-50">
          <CardContent className="pt-6">
            <div className="text-sm text-gray-600">
              <div>📊 ファイル状況: 合計 {totalFiles}件 | 配置済み {placedCount}件 | 未配置 {unplacedFiles.length}件</div>
              <div>👥 生徒数: {sortedStudents.length}名</div>
              <div>📄 模範解答ページ数: {masterImageCount}ページ</div>
              <div>🔄 変換中: {isConverting ? "Yes" : "No"} | アップロード中: {isUploading ? "Yes" : "No"}</div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}