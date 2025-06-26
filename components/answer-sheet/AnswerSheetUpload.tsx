"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { AlertCircle, Upload, Grid3X3 } from "lucide-react"
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
    setSelectedTab,
    setShowPasswordDialog,
    setCurrentPdfFile,
    setPasswordError,

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
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            アップロード
          </TabsTrigger>
          <TabsTrigger value="grid" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            生徒と答案の対応
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUploadZone
            onDrop={onDrop}
            isConverting={isConverting}
            isClient={isClient}
          />
        </TabsContent>


        <TabsContent value="grid" className="space-y-6">
          <AnswerSheetGridManager
            projectId={projectId}
            students={students}
            files={files}
            isUploading={isUploading}
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
        </TabsContent>
      </Tabs>

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
