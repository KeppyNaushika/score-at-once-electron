"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { AlertCircle, Upload, Grid3X3, FileImage, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAnswerSheetUpload } from "@/hooks/useAnswerSheetUpload"
import FileUploadZone from "./FileUploadZone"
import AnswerSheetGridManager from "./grid/AnswerSheetGridManager"

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
  onUploadComplete?: () => void
}

export default function AnswerSheetUpload({
  projectId,
  students,
  onUploadComplete,
}: AnswerSheetUploadProps) {
  const {
    // State
    files,
    isUploading,
    isConverting,
    uploadProgress,
    selectedTab,
    showPasswordDialog,
    currentPdfFile,
    passwordError,
    isPasswordProcessing,
    isClient,
    fileOrder,
    setSelectedTab,
    setShowPasswordDialog,
    setCurrentPdfFile,
    setPasswordError,
    setFileOrder,

    // Actions
    onDrop,
    handlePasswordSubmit,

    // Computed
    selectedFilesCount,
    selectedStudentsCount,
  } = useAnswerSheetUpload({
    projectId,
    students,
    onUploadComplete,
  })

  return (
    <div className="space-y-6">
      {/* ファイル配置戦略選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileImage className="h-5 w-5" />
            ファイル配置戦略
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={fileOrder === 'page-then-student' ? 'default' : 'outline'}
              onClick={() => setFileOrder('page-then-student')}
              className="flex items-center gap-2"
            >
              <FileImage className="h-4 w-4" />
              ページごと並べる
              <Badge variant="secondary" className="ml-1">推奨</Badge>
            </Button>
            <Button
              variant={fileOrder === 'student-then-page' ? 'default' : 'outline'}
              onClick={() => setFileOrder('student-then-page')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              生徒ごと並べる
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            {fileOrder === 'page-then-student' 
              ? 'ページ順でファイルを並べます（1ページ目全員 → 2ページ目全員）'
              : '生徒順でファイルを並べます（生徒1の全ページ → 生徒2の全ページ）'
            }
          </p>
        </CardContent>
      </Card>

      {/* ファイルアップロード */}
      <FileUploadZone
        onDrop={onDrop}
        isConverting={isConverting}
        isClient={isClient}
      />

      {/* 生徒と答案の対応管理 */}
      <AnswerSheetGridManager
        projectId={projectId}
        students={students}
        files={files}
        isUploading={isUploading}
        fileOrder={fileOrder}
        onUpload={(uploadData) => {
          // アップロードデータを既存のアップロード処理に変換
          const formattedData = uploadData.map(item => ({
            name: item.file.name,
            fileName: item.file.name,
            originalFileName: item.file.originalFileName,
            type: item.file.type,
            buffer: item.file.buffer,
            studentId: item.studentId,
            pageNumber: item.pageNumber,
            overwrite: false, // グリッドでは上書き設定は個別に管理
          }))
          
          // 既存のElectronAPIを呼び出し
          window.electronAPI.uploadAnswerSheets(projectId, formattedData)
            .then(result => {
              if (result.success) {
                onUploadComplete?.()
              }
            })
            .catch(console.error)
        }}
      />

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
          // setIsConverting(false) // Removed as function doesn't exist
        }}
        onSubmit={handlePasswordSubmit}
        fileName={currentPdfFile?.name || ""}
        error={passwordError}
        isLoading={isPasswordProcessing}
      />
    </div>
  )
}
