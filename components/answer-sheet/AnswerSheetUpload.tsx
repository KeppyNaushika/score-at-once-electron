"use client"

import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { Button } from "@/components/ui/button"
import { convertPdfToImages, getPdfPageCount } from "@/lib/pdfConverter"
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
  // 開発時のみデバッグ情報を出力
  if (process.env.NODE_ENV === "development") {
    console.log("👥 受け取った生徒データ（順序確認）:", students.map((s, i) => ({
      index: i,
      name: `${s.lastName} ${s.firstName}`,
      customOrder: s.customOrder,
      attendanceNumber: s.attendanceNumber
    })))
  }
  // ============================================================================
  // State管理（ファイル処理用）
  // ============================================================================

  const [isConverting, setIsConverting] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string>("")
  const [isPasswordProcessing, setIsPasswordProcessing] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [passwordAttempts, setPasswordAttempts] = useState(0)
  const [pdfProcessingProgress, setPdfProcessingProgress] = useState(0)
  const [isPdfProcessing, setIsPdfProcessing] = useState(false)
  const [currentProcessingFile, setCurrentProcessingFile] = useState<string>("")
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

  const convertSingleFileToImages = useCallback(
    async (file: File, password?: string, onProgress?: (current: number, total: number) => void): Promise<ConvertedFileTemp[]> => {
      const convertedFiles: ConvertedFileTemp[] = []
      
      try {
        if (file.type === "application/pdf") {
          const images = await convertPdfToImages(file, password, onProgress)
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
        if (error instanceof Error && error.message.includes("password")) {
          // パスワードエラーの場合は静かに再スロー（ログ出力なし）
          throw error
        } else {
          // パスワード関連以外のエラーのみログ出力
          console.error(`Failed to convert file ${file.name}:`, error)
          toast.error(`ファイル ${file.name} の変換に失敗しました`)
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
      console.log("🔄 processFiles: 開始", { fileCount: fileList.length, hasPassword: !!password })
      setIsConverting(true)
      setPasswordError("")

      try {
        // 各ファイルのページ数を事前取得
        console.log("📊 ページ数計算中...")
        let totalPages = 0
        const filePageCounts: number[] = []
        
        for (const file of fileList) {
          try {
            if (file.type === "application/pdf") {
              const pageCount = await getPdfPageCount(file, password)
              filePageCounts.push(pageCount)
              totalPages += pageCount
            } else {
              filePageCounts.push(1) // 画像は1ページ
              totalPages += 1
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes("password")) {
              throw error
            } else {
              filePageCounts.push(1) // エラー時は1ページとして扱う
              totalPages += 1
            }
          }
        }
        
        console.log(`📊 総ページ数: ${totalPages}ページ`)
        
        const allConvertedFiles: ConvertedFileTemp[] = []
        let processedPages = 0

        // ファイル順次処理（ページ単位プログレス更新）
        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          const expectedPages = filePageCounts[i]
          
          try {
            console.log(`🔄 処理開始: ${file.name} (${expectedPages}ページ)`)
            setCurrentProcessingFile(file.name)

            // ページ単位プログレス更新コールバック
            const onProgress = (currentPage: number, totalPagesInFile: number) => {
              const currentFileProgress = processedPages + currentPage
              const progress = Math.round((currentFileProgress / totalPages) * 100)
              setPdfProcessingProgress(progress)
              console.log(`📄 ページ ${currentPage}/${totalPagesInFile} 完了 (全体進捗: ${currentFileProgress}/${totalPages} = ${progress}%)`)
            }

            const convertedFiles = await convertSingleFileToImages(file, password, onProgress)
            allConvertedFiles.push(...convertedFiles)
            
            processedPages += convertedFiles.length
            console.log(`✅ ファイル完了: ${file.name} - ${convertedFiles.length}ページ`)
            
          } catch (error) {
            if (error instanceof Error && error.message.includes("password")) {
              // パスワード必要エラーの場合は静かに再スロー
              throw error
            } else {
              console.error(`❌ エラー: ${file.name}`, error)
              toast.error(`ファイル ${file.name} の処理に失敗しました`)
              processedPages += expectedPages // エラー時も予想ページ数分進める
              setPdfProcessingProgress(Math.round((processedPages / totalPages) * 100))
            }
          }
        }
        
        // ConvertedFileTemp → UnifiedFile に変換（直接配置対応）
        console.log(`🎯 自動配置開始: masterImageCount=${masterImageCount}, 生徒数=${students.length}, ファイル数=${allConvertedFiles.length}`)
        
        const unifiedFiles: UnifiedFile[] = allConvertedFiles.map((f, index) => {
          // 自動配置ロジック: 生徒順→ページ順で配置
          const studentIndex = Math.floor(index / masterImageCount)
          const pageIndex = index % masterImageCount
          const targetStudent = students[studentIndex % students.length]
          
          console.log(`📄 ファイル${index}: studentIndex=${studentIndex}, pageIndex=${pageIndex}, 生徒=${targetStudent?.lastName} ${targetStudent?.firstName}`)
          
          return {
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            buffer: f.buffer,
            preview: f.preview,
            studentId: targetStudent?.id, // 直接配置
            pageNumber: pageIndex + 1, // 1ベースのページ番号
            isSelected: f.isSelected,
            originalFileName: f.originalFileName,
            pageLabel: f.pageLabel,
          }
        })

        // ファイルを追加（直接配置済み）
        addFiles(unifiedFiles)
        
        // 成功メッセージ
        if (allConvertedFiles.length > 0) {
          toast.success(`${allConvertedFiles.length}件のファイルを直接配置しました`)
        }
        
        console.log(`完了: ${allConvertedFiles.length}個の画像を直接配置`)
        
      } catch (error) {
        if (error instanceof Error && error.message.includes("password")) {
          // パスワードが必要な場合はログ出力せず、パスワード入力画面を表示
          setPasswordError("")
          setPasswordAttempts(0) // 初回試行
          setShowPasswordDialog(true)
          setCurrentPdfFile(fileList[0]) // 最初のファイルを設定
          setPendingFiles(fileList)
        } else {
          // パスワード関連以外のエラーのみログ出力
          console.error("File processing error:", error)
          toast.error("ファイル処理に失敗しました")
        }
      } finally {
        setIsConverting(false)
        setIsPasswordProcessing(false)
      }
    },
    [addFiles, convertSingleFileToImages, students, masterImageCount]
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
        console.log("❌ handlePasswordSubmit: 条件チェック失敗", { currentPdfFile, pendingFilesLength: pendingFiles.length })
        return
      }

      console.log("🔐 handlePasswordSubmit: 開始", { fileName: currentPdfFile.name, pendingFilesCount: pendingFiles.length })
      
      setIsPasswordProcessing(true)
      setPasswordError("")
      setPasswordAttempts(prev => prev + 1)

      const fileName = currentPdfFile.name // ファイル名を保存

      try {
        console.log("🔐 handlePasswordSubmit: 直接処理開始")
        
        // 認証成功 - ダイアログを閉じてプログレス表示開始
        setShowPasswordDialog(false)
        setCurrentPdfFile(null)
        setPasswordError("")
        setPasswordAttempts(0)
        setIsPasswordProcessing(false)
        
        console.log("📊 handlePasswordSubmit: PDF処理開始設定")
        // PDF処理開始
        setIsPdfProcessing(true)
        setCurrentProcessingFile(fileName)
        setPdfProcessingProgress(0)
        
        // 短い遅延を追加してUIを更新
        await new Promise(resolve => setTimeout(resolve, 100))
        
        console.log("🔄 handlePasswordSubmit: processFiles呼び出し開始")
        // すべてのファイルを統一システムで処理
        await processFiles(pendingFiles, password)
        
        console.log("✅ handlePasswordSubmit: processFiles完了")
        // 処理完了
        setPendingFiles([])
        setIsPdfProcessing(false)
        setPdfProcessingProgress(0)
        setCurrentProcessingFile("")
        
      } catch (error) {
        console.error("❌ handlePasswordSubmit: エラー", error)
        if (error instanceof Error && error.message.includes("password")) {
          setPasswordError("invalid-password")
        } else {
          setPasswordError("処理中にエラーが発生しました")
        }
        setIsPasswordProcessing(false)
        // エラー時もPDF処理状態をリセット
        setIsPdfProcessing(false)
        setPdfProcessingProgress(0)
        setCurrentProcessingFile("")
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

      {/* PDF処理プログレス */}
      {isPdfProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-sm">PDF処理中...</span>
                <span className="text-muted-foreground text-sm">
                  {Math.round(pdfProcessingProgress)}%
                </span>
              </div>
              <Progress value={pdfProcessingProgress} className="w-full" />
              {currentProcessingFile && (
                <p className="text-muted-foreground mt-2 text-xs">
                  現在処理中: {currentProcessingFile}
                </p>
              )}
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
          setPasswordAttempts(0)
        }}
        onSubmit={handlePasswordSubmit}
        fileName={currentPdfFile?.name || ""}
        error={passwordError}
        isLoading={isPasswordProcessing}
        isFirstAttempt={passwordAttempts === 0}
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