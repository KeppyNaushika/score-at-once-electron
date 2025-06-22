"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Upload, FileImage, X, UserCircle, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { UploadAnswerSheetFileData } from "@/types/electron"

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

interface FileWithPreview extends File {
  preview?: string
  studentId?: string
  pageNumber?: number
}

export default function AnswerSheetUpload({
  projectId,
  students,
  onUploadComplete,
}: AnswerSheetUploadProps) {
  const [files, setFiles] = useState<FileWithPreview[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const router = useRouter()

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = acceptedFiles.map((file) => {
        const fileWithPreview = Object.assign(file, {
          preview: URL.createObjectURL(file),
          pageNumber: 1,
        }) as FileWithPreview
        return fileWithPreview
      })

      // ファイル名から生徒を自動推測
      const filesWithStudentGuess = newFiles.map((file) => {
        const fileName = file.name.toLowerCase()
        const matchedStudent = students.find((student) => {
          const studentName = `${student.lastName}${student.firstName}`.toLowerCase()
          const studentNameKana = `${student.lastNameKana}${student.firstNameKana}`.toLowerCase()
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
    },
    [students],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".tiff", ".bmp"],
      "application/pdf": [".pdf"],
    },
    multiple: true,
  })

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      if (newFiles[index].preview) {
        URL.revokeObjectURL(newFiles[index].preview!)
      }
      newFiles.splice(index, 1)
      return newFiles
    })
  }

  const updateFileStudent = (index: number, studentId: string) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      newFiles[index].studentId = studentId
      return newFiles
    })
  }

  const updateFilePageNumber = (index: number, pageNumber: number) => {
    setFiles((prev) => {
      const newFiles = [...prev]
      newFiles[index].pageNumber = pageNumber
      return newFiles
    })
  }

  const handleUpload = async () => {
    if (files.length === 0) {
      toast.error("アップロードするファイルを選択してください")
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const filesData: UploadAnswerSheetFileData[] = await Promise.all(
        files.map(async (file) => {
          const buffer = await file.arrayBuffer()
          return {
            name: file.name,
            type: file.type,
            buffer,
            studentId: file.studentId,
            pageNumber: file.pageNumber || 1,
          }
        }),
      )

      // 進捗を更新
      setUploadProgress(50)

      const result = await window.electronAPI.uploadAnswerSheets(
        projectId,
        filesData,
      )

      if (result.success) {
        setUploadProgress(100)
        toast.success(`${files.length}件の答案をアップロードしました`)

        // ファイルリストをクリア
        files.forEach((file) => {
          if (file.preview) {
            URL.revokeObjectURL(file.preview)
          }
        })
        setFiles([])

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
    const student = students.find((s) => s.id === studentId)
    return student ? `${student.lastName} ${student.firstName} (${student.studentId})` : "未設定"
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>答案画像のアップロード</CardTitle>
          <CardDescription>
            試験の答案画像ファイルをドラッグ&ドロップまたはクリックして選択してください。
            PNG、JPEG、PDF形式に対応しています。
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
            <Upload className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
            {isDragActive ? (
              <p className="text-lg">ファイルをドロップしてください...</p>
            ) : (
              <div>
                <p className="mb-2 text-lg">
                  ファイルをドラッグ&ドロップするか、クリックして選択
                </p>
                <p className="text-muted-foreground text-sm">
                  PNG, JPEG, PDF ファイルに対応
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>アップロード予定ファイル ({files.length}件)</CardTitle>
            <CardDescription>
              各ファイルの生徒とページ番号を確認・設定してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 rounded-lg border p-4"
                >
                  <div className="flex-shrink-0">
                    {file.preview && (
                      <img
                        src={file.preview}
                        alt={file.name}
                        className="h-16 w-16 rounded border object-cover"
                        onLoad={() => URL.revokeObjectURL(file.preview!)}
                      />
                    )}
                    {!file.preview && (
                      <div className="flex h-16 w-16 items-center justify-center rounded border">
                        <FileImage className="text-muted-foreground h-8 w-8" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{file.name}</p>
                    <p className="text-muted-foreground text-sm">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <UserCircle className="h-4 w-4" />
                      <Select
                        value={file.studentId || ""}
                        onValueChange={(value) =>
                          updateFileStudent(index, value)
                        }
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="生徒を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {students.map((student) => (
                            <SelectItem key={student.id} value={student.id}>
                              {student.lastName} {student.firstName} ({student.studentId})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-sm">P.</span>
                      <Select
                        value={file.pageNumber?.toString() || "1"}
                        onValueChange={(value) =>
                          updateFilePageNumber(index, parseInt(value))
                        }
                      >
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((page) => (
                            <SelectItem key={page} value={page.toString()}>
                              {page}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={isUploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {isUploading && (
              <div className="mt-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm">アップロード中...</span>
                  <span className="text-muted-foreground text-sm">
                    {uploadProgress}%
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <AlertCircle className="h-4 w-4" />
                生徒が未設定のファイルは後で関連付けできます
              </div>
              <Button
                onClick={handleUpload}
                disabled={isUploading || files.length === 0}
                className="min-w-24"
              >
                {isUploading ? "アップロード中..." : "アップロード"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
