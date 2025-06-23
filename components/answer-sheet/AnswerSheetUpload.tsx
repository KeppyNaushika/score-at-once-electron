"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePdfConverter } from "@/hooks/usePdfConverter"
import type { UploadAnswerSheetFileData } from "@/types/electron"
import {
  AlertCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileImage,
  FileText,
  Image as ImageIcon,
  RefreshCw,
  Square,
  Upload,
  UserCircle,
  X,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"

interface AnswerSheetUploadProps {
  projectId: string
  students: Array<{
    id: string
    lastName: string
    firstName: string
    lastNameKana: string
    firstNameKana: string
    studentId: string
  }>
  onUploadComplete?: () => void
}

interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  buffer: ArrayBuffer
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  originalFileName: string
  pageLabel?: string
}

interface StudentWithAnswers {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  isSelected: boolean
  hasExistingAnswers: boolean
  overwrite: boolean
}

export default function AnswerSheetUpload({
  projectId,
  students,
  onUploadComplete,
}: AnswerSheetUploadProps) {
  const [files, setFiles] = useState<ConvertedFile[]>([])
  const [studentsWithAnswers, setStudentsWithAnswers] = useState<
    StudentWithAnswers[]
  >([])
  const [isUploading, setIsUploading] = useState(false)
  const [isConverting, setIsConverting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedTab, setSelectedTab] = useState("upload")
  const [maxPages, setMaxPages] = useState(1)
  const router = useRouter()
  const { convertPdfToImages } = usePdfConverter()

  // 生徒の既存答案をチェック
  useEffect(() => {
    const checkExistingAnswers = async () => {
      try {
        const result =
          await window.electronAPI.getAnswerSheetsByProjectId(projectId)
        const existingAnswers = result.success ? result.answerSheets : []

        const studentsWithAnswerStatus = students.map((student) => {
          const hasExistingAnswers =
            existingAnswers?.some(
              (answer: any) => answer.studentId === student.id,
            ) ?? false
          return {
            ...student,
            isSelected: !hasExistingAnswers, // 既存答案がない生徒を選択
            hasExistingAnswers,
            overwrite: false,
          }
        })

        setStudentsWithAnswers(studentsWithAnswerStatus)
      } catch (error) {
        console.error("Error checking existing answers:", error)
        // エラーの場合は全生徒を選択状態に
        setStudentsWithAnswers(
          students.map((student) => ({
            ...student,
            isSelected: true,
            hasExistingAnswers: false,
            overwrite: false,
          })),
        )
      }
    }

    checkExistingAnswers()
  }, [students, projectId])

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsConverting(true)

      try {
        const allConvertedFiles: ConvertedFile[] = []
        let fileIndex = 0

        for (const file of acceptedFiles) {
          if (file.type === "application/pdf") {
            // PDF → PNG変換
            const convertedImages = await convertPdfToImages(file)

            for (
              let pageIndex = 0;
              pageIndex < convertedImages.length;
              pageIndex++
            ) {
              const converted = convertedImages[pageIndex]
              const convertedFile: ConvertedFile = {
                id: `${Date.now()}-${fileIndex}-${pageIndex}`,
                name: converted.name,
                type: converted.type,
                size: converted.buffer.byteLength,
                buffer: converted.buffer,
                preview: URL.createObjectURL(
                  new Blob([converted.buffer], { type: converted.type }),
                ),
                pageNumber: 1,
                isSelected: true,
                originalFileName: file.name,
                pageLabel: `${file.name} - ページ ${pageIndex + 1}`,
              }

              allConvertedFiles.push(convertedFile)
            }

            setMaxPages((prev) => Math.max(prev, convertedImages.length))
          } else {
            // 画像ファイル
            const buffer = await file.arrayBuffer()
            const convertedFile: ConvertedFile = {
              id: `${Date.now()}-${fileIndex}`,
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview: URL.createObjectURL(file),
              pageNumber: 1,
              isSelected: true,
              originalFileName: file.name,
              pageLabel: file.name,
            }

            allConvertedFiles.push(convertedFile)
          }

          fileIndex++
        }

        // ファイル名から生徒を自動推測
        const filesWithStudentGuess = allConvertedFiles.map((file) => {
          const fileName = file.name.toLowerCase()
          const matchedStudent = studentsWithAnswers.find((student) => {
            const studentName =
              `${student.lastName}${student.firstName}`.toLowerCase()
            const studentNameKana =
              `${student.lastNameKana}${student.firstNameKana}`.toLowerCase()
            const studentId = student.studentId.toLowerCase()
            return (
              fileName.includes(studentName) ||
              fileName.includes(studentNameKana) ||
              fileName.includes(studentId)
            )
          })

          if (matchedStudent) {
            file.studentId = matchedStudent.id
          }

          return file
        })

        setFiles((prev) => [...prev, ...filesWithStudentGuess])

        if (allConvertedFiles.length > 0) {
          setSelectedTab("manage")
        }
      } catch (error) {
        console.error("Error converting files:", error)
        toast.error("ファイルの変換に失敗しました")
      } finally {
        setIsConverting(false)
      }
    },
    [studentsWithAnswers, convertPdfToImages],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".bmp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
  })

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === id)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((f) => f.id !== id)
    })
  }

  const toggleFileSelection = (id: string) => {
    setFiles((prev) =>
      prev.map((file) =>
        file.id === id ? { ...file, isSelected: !file.isSelected } : file,
      ),
    )
  }

  const moveFile = (id: string, direction: "up" | "down") => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id)
      if (index === -1) return prev

      const newIndex = direction === "up" ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= prev.length) return prev

      const newFiles = [...prev]
      const [moved] = newFiles.splice(index, 1)
      newFiles.splice(newIndex, 0, moved)
      return newFiles
    })
  }

  const shiftStudent = (id: string, direction: "next" | "prev") => {
    setFiles((prev) => {
      const index = prev.findIndex((f) => f.id === id)
      if (index === -1) return prev

      const currentStudentIndex = studentsWithAnswers.findIndex(
        (s) => s.id === prev[index].studentId,
      )
      if (currentStudentIndex === -1) return prev

      const nextIndex =
        direction === "next" ? currentStudentIndex + 1 : currentStudentIndex - 1
      if (nextIndex < 0 || nextIndex >= studentsWithAnswers.length) return prev

      const nextStudent = studentsWithAnswers[nextIndex]

      return prev.map((file) =>
        file.id === id ? { ...file, studentId: nextStudent.id } : file,
      )
    })
  }

  const updateFileStudent = (id: string, studentId: string) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, studentId } : file)),
    )
  }

  const updateFilePageNumber = (id: string, pageNumber: number) => {
    setFiles((prev) =>
      prev.map((file) => (file.id === id ? { ...file, pageNumber } : file)),
    )
  }

  const toggleStudentSelection = (studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, isSelected: !student.isSelected }
          : student,
      ),
    )
  }

  const toggleStudentOverwrite = (studentId: string) => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, overwrite: !student.overwrite }
          : student,
      ),
    )
  }

  const selectAllStudents = () => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) => ({ ...student, isSelected: true })),
    )
  }

  const deselectAllStudents = () => {
    setStudentsWithAnswers((prev) =>
      prev.map((student) => ({ ...student, isSelected: false })),
    )
  }

  const handleUpload = async () => {
    const selectedFiles = files.filter((f) => f.isSelected)
    const selectedStudents = studentsWithAnswers.filter((s) => s.isSelected)

    if (selectedFiles.length === 0) {
      toast.error("アップロードするファイルを選択してください")
      return
    }

    // 上書き確認
    const filesToOverwrite = selectedFiles.filter((file) => {
      const student = studentsWithAnswers.find((s) => s.id === file.studentId)
      return student?.hasExistingAnswers && !student?.overwrite
    })

    if (filesToOverwrite.length > 0) {
      const confirm = window.confirm(
        `${filesToOverwrite.length}件のファイルで既存答案が上書きされます。続行しますか？`,
      )
      if (!confirm) return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const filesData: UploadAnswerSheetFileData[] = selectedFiles
        .filter((file) => {
          // 選択された生徒に関連付けられたファイルのみ
          const student = studentsWithAnswers.find(
            (s) => s.id === file.studentId,
          )
          return student?.isSelected
        })
        .map((file) => ({
          name: file.name,
          type: file.type,
          buffer: file.buffer,
          studentId: file.studentId,
          pageNumber: file.pageNumber,
        }))

      // 進捗を更新
      setUploadProgress(50)

      const result = await window.electronAPI.uploadAnswerSheets(
        projectId,
        filesData,
      )

      if (result.success) {
        setUploadProgress(100)
        toast.success(`${filesData.length}件の答案をアップロードしました`)

        // プレビューURLをクリーンアップ
        files.forEach((file) => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview)
          }
        })
        setFiles([])
        setSelectedTab("upload")

        // コールバック実行
        onUploadComplete?.()
      } else {
        throw new Error(result.error || "アップロードに失敗しました")
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(
        error instanceof Error ? error.message : "アップロードに失敗しました",
      )
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const getStudentName = (studentId?: string) => {
    if (!studentId) return "未設定"
    const student = studentsWithAnswers.find((s) => s.id === studentId)
    return student
      ? `${student.lastName} ${student.firstName} (${student.studentId})`
      : "未設定"
  }

  const selectedFilesCount = files.filter((f) => f.isSelected).length
  const selectedStudentsCount = studentsWithAnswers.filter(
    (s) => s.isSelected,
  ).length

  return (
    <div className="space-y-6">
      <Tabs
        value={selectedTab}
        onValueChange={setSelectedTab}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            アップロード
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            ファイル管理 ({files.length})
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <UserCircle className="h-4 w-4" />
            生徒選択 ({selectedStudentsCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>答案画像・PDFのアップロード</CardTitle>
              <CardDescription>
                試験の答案画像ファイルをドラッグ&ドロップまたはクリックして選択してください。
                <br />
                PDFは自動的にPNG画像に変換されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
              >
                <input {...getInputProps()} />
                {isConverting ? (
                  <div className="space-y-4">
                    <RefreshCw className="text-primary mx-auto h-12 w-12 animate-spin" />
                    <p className="text-lg">ファイルを変換中...</p>
                  </div>
                ) : (
                  <>
                    <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
                    {isDragActive ? (
                      <p className="text-lg">
                        ファイルをドロップしてください...
                      </p>
                    ) : (
                      <div>
                        <p className="mb-2 text-lg">
                          ファイルをドラッグ&ドロップするか、クリックして選択
                        </p>
                        <p className="text-muted-foreground text-sm">
                          PNG, JPEG, PDF
                          ファイルに対応。PDFはページ別にPNG変換されます。
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>ファイル管理 ({files.length}件)</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      選択: {selectedFilesCount}件
                    </Badge>
                    {maxPages > 1 && (
                      <Badge variant="secondary">最大ページ: {maxPages}</Badge>
                    )}
                  </div>
                </CardTitle>
                <CardDescription>
                  ファイルの順序、生徒、ページを設定してください。DnDで入れ替え可能です。
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {files.map((file, index) => (
                    <div
                      key={file.id}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                        file.isSelected
                          ? "bg-primary/5 border-primary/20"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {/* 選択チェックボックス */}
                      <Checkbox
                        checked={file.isSelected}
                        onCheckedChange={() => toggleFileSelection(file.id)}
                        disabled={isUploading}
                      />

                      {/* プレビュー画像 */}
                      <div className="flex-shrink-0">
                        {file.preview ? (
                          <img
                            src={file.preview}
                            alt={file.name}
                            className="h-12 w-12 rounded border object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded border">
                            {file.type.startsWith("image/") ? (
                              <ImageIcon className="text-muted-foreground h-6 w-6" />
                            ) : (
                              <FileText className="text-muted-foreground h-6 w-6" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* ファイル情報 */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {file.pageLabel || file.name}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      {/* 生徒選択 */}
                      <div className="flex items-center gap-1">
                        <UserCircle className="h-3 w-3" />
                        <Select
                          value={file.studentId || ""}
                          onValueChange={(value) =>
                            updateFileStudent(file.id, value)
                          }
                          disabled={isUploading}
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue placeholder="生徒を選択" />
                          </SelectTrigger>
                          <SelectContent>
                            {studentsWithAnswers.map((student) => (
                              <SelectItem key={student.id} value={student.id}>
                                {student.lastName} {student.firstName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* ページ選択 */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs">P.</span>
                        <Select
                          value={file.pageNumber.toString()}
                          onValueChange={(value) =>
                            updateFilePageNumber(file.id, parseInt(value))
                          }
                          disabled={isUploading}
                        >
                          <SelectTrigger className="h-8 w-16 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from(
                              { length: Math.max(maxPages, 5) },
                              (_, i) => i + 1,
                            ).map((page) => (
                              <SelectItem key={page} value={page.toString()}>
                                {page}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 生徒シフトボタン */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => shiftStudent(file.id, "prev")}
                          disabled={isUploading}
                          title="前の生徒に移動"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => shiftStudent(file.id, "next")}
                          disabled={isUploading}
                          title="次の生徒に移動"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* ファイル順序移動ボタン */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveFile(file.id, "up")}
                          disabled={isUploading || index === 0}
                          title="上に移動"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => moveFile(file.id, "down")}
                          disabled={isUploading || index === files.length - 1}
                          title="下に移動"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>

                      {/* 削除ボタン */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeFile(file.id)}
                        disabled={isUploading}
                        title="削除"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="students" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>生徒選択</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllStudents}
                    disabled={isUploading}
                  >
                    <CheckSquare className="mr-1 h-4 w-4" />
                    全選択
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={deselectAllStudents}
                    disabled={isUploading}
                  >
                    <Square className="mr-1 h-4 w-4" />
                    全解除
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>
                アップロードする生徒を選択してください。既存答案がある場合は上書き設定も確認してください。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {studentsWithAnswers.map((student) => (
                  <div
                    key={student.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      student.isSelected
                        ? "bg-primary/5 border-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={student.isSelected}
                      onCheckedChange={() => toggleStudentSelection(student.id)}
                      disabled={isUploading}
                    />

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {student.lastName} {student.firstName}
                        </span>
                        <Badge variant="outline">{student.studentId}</Badge>

                        {student.hasExistingAnswers && (
                          <Badge variant="destructive" className="text-xs">
                            既存答案あり
                          </Badge>
                        )}
                      </div>

                      <p className="text-muted-foreground mt-1 text-xs">
                        {student.lastNameKana} {student.firstNameKana}
                      </p>
                    </div>

                    {student.hasExistingAnswers && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={student.overwrite}
                          onCheckedChange={() =>
                            toggleStudentOverwrite(student.id)
                          }
                          disabled={isUploading || !student.isSelected}
                        />
                        <span className="text-muted-foreground text-sm">
                          上書き
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
    </div>
  )
}
