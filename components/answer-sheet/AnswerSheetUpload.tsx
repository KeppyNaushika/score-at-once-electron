"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PasswordDialog } from "@/components/ui/password-dialog"
import { AlertCircle, FileImage, Upload } from "lucide-react"
import { useAnswerSheetUpload } from "@/hooks/useAnswerSheetUpload"
import FileUploadZone from "./FileUploadZone"
import BatchSettings from "./BatchSettings"
import StudentList from "./StudentList"
import FileManagement from "./FileManagement"

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
    studentsWithAnswers,
    isUploading,
    isConverting,
    uploadProgress,
    selectedTab,
    maxPages,
    pageRange,
    specificPages,
    fileOrder,
    assignmentMode,
    sortMode,
    showPasswordDialog,
    currentPdfFile,
    passwordError,
    isPasswordProcessing,
    layoutRegions,
    masterImages,
    isClient,
    setSelectedTab,
    setPageRange,
    setSpecificPages,
    setFileOrder,
    setAssignmentMode,
    setSortMode,
    setShowPasswordDialog,
    setCurrentPdfFile,
    setPasswordError,
    // setIsConverting, // Removed as it's not available in the hook

    // Actions
    onDrop,
    removeFile,
    toggleFileSelection,
    moveFile,
    toggleStudentSelection,
    toggleStudentOverwrite,
    selectAllStudents,
    deselectAllStudents,
    getStudentName,
    handleDragEnd,
    handleUpload,
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
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            ファイル・生徒管理 ({files.length}ファイル, {selectedStudentsCount}
            生徒)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUploadZone
            onDrop={onDrop}
            isConverting={isConverting}
            isClient={isClient}
          />
        </TabsContent>

        <TabsContent value="manage" className="space-y-6">
          {files.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-muted-foreground py-8 text-center">
                  ファイルをアップロードしてください
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* バッチ設定 */}
              <BatchSettings
                assignmentMode={assignmentMode}
                setAssignmentMode={setAssignmentMode}
                fileOrder={fileOrder}
                setFileOrder={setFileOrder}
                sortMode={sortMode}
                setSortMode={setSortMode}
                pageRange={pageRange}
                setPageRange={setPageRange}
                specificPages={specificPages}
                setSpecificPages={setSpecificPages}
              />

              {/* ファイル・生徒管理 */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {/* 左列: 生徒一覧 */}
                <StudentList
                  studentsWithAnswers={studentsWithAnswers}
                  files={files}
                  selectedStudentsCount={selectedStudentsCount}
                  isUploading={isUploading}
                  onToggleStudentSelection={toggleStudentSelection}
                  onToggleStudentOverwrite={toggleStudentOverwrite}
                  onSelectAllStudents={selectAllStudents}
                  onDeselectAllStudents={deselectAllStudents}
                />

                {/* 右列: ファイル一覧 */}
                <FileManagement
                  files={files}
                  selectedFilesCount={selectedFilesCount}
                  maxPages={maxPages}
                  layoutRegions={layoutRegions}
                  masterImages={masterImages}
                  isUploading={isUploading}
                  getStudentName={(studentId) =>
                    getStudentName(studentId || "")
                  }
                  onToggleFileSelection={toggleFileSelection}
                  onMoveFile={(id, direction) => {
                    const currentIndex = files.findIndex((f) => f.id === id)
                    const targetIndex =
                      direction === "up" ? currentIndex - 1 : currentIndex + 1
                    if (targetIndex >= 0 && targetIndex < files.length) {
                      moveFile(currentIndex, targetIndex)
                    }
                  }}
                  onRemoveFile={removeFile}
                  onDragEnd={handleDragEnd}
                />
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* アップロードバー */}
      {files.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            {isUploading && (
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm">アップロード中...</span>
                  <span className="text-muted-foreground text-sm">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                選択された {selectedFilesCount} 件のファイルを{" "}
                {selectedStudentsCount} 人の生徒にアップロードします
              </div>
              <Button
                onClick={handleUpload}
                disabled={
                  isUploading ||
                  selectedFilesCount === 0 ||
                  selectedStudentsCount === 0
                }
                className="min-w-32"
              >
                {isUploading
                  ? "アップロード中..."
                  : `${selectedFilesCount}件をアップロード`}
              </Button>
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
