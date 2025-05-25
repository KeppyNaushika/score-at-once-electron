"use client"

import React, { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useDropzone } from "react-dropzone"
import { Prisma } from "@prisma/client"
import { UploadCloud } from "lucide-react"

type StudentWithClass = Prisma.StudentGetPayload<{ include: { class: true } }>
type ClassWithStudents = Prisma.ClassGetPayload<{ include: { students: true } }>

interface StudentImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess: (importedStudents: StudentWithClass[]) => void
  existingClasses: ClassWithStudents[] // To map class names to class IDs
}

export default function StudentImportModal({
  isOpen,
  onClose,
  onImportSuccess,
  existingClasses,
}: StudentImportModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles && acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setError(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      // TODO: Define accepted file types, e.g., Excel
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: false,
  })

  const handleImport = async () => {
    if (!file) {
      setError("ファイルを選択してください。")
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      // TODO: Implement actual file parsing and student creation via window.electronAPI
      // This will involve sending the file path or content to the main process
      // The main process will parse the Excel/CSV, map class names to IDs,
      // create/update students, and return the list of imported/updated students.
      const filePath = (file as any).path // Electron specific path for native file dialogs
      if (!filePath) {
        throw new Error(
          "ファイルパスが取得できませんでした。ドラッグ＆ドロップで再度お試しください。",
        )
      }

      const result = await window.electronAPI.importStudentsFromFile(
        filePath,
        existingClasses.map((c) => ({ id: c.id, name: c.name })),
      )

      if (result.success && result.importedStudents) {
        onImportSuccess(result.importedStudents)
        onClose()
      } else {
        setError(result.error || "生徒のインポートに失敗しました。")
      }
    } catch (err: any) {
      console.error("Import failed:", err)
      setError(err.message || "インポート処理中にエラーが発生しました。")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>生徒名簿をインポート</DialogTitle>
          <DialogDescription>
            Excel (xlsx, xls) または CSV
            ファイルを選択して生徒情報を一括登録します。
            ファイルには「学籍番号」「氏名」「学級名」の列を含めてください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div
            {...getRootProps()}
            className={`mt-1 flex justify-center rounded-md border-2 border-dashed px-6 pt-5 pb-6 ${isDragActive ? "border-primary bg-primary/10" : "border-gray-300 dark:border-gray-600"} cursor-pointer transition-colors hover:border-gray-400 dark:hover:border-gray-500`}
          >
            <div className="space-y-1 text-center">
              <UploadCloud
                className={`mx-auto h-12 w-12 ${isDragActive ? "text-primary" : "text-gray-400"}`}
              />
              <div className="flex text-sm text-gray-600 dark:text-gray-400">
                <Label
                  htmlFor="file-upload"
                  className="text-primary focus-within:ring-primary hover:text-primary/80 relative cursor-pointer rounded-md bg-white font-medium focus-within:ring-2 focus-within:ring-offset-2 focus-within:outline-none dark:bg-transparent"
                >
                  <span>ファイルをアップロード</span>
                  <Input
                    {...getInputProps()}
                    id="file-upload"
                    name="file-upload"
                    type="file"
                    className="sr-only"
                  />
                </Label>
                <p className="pl-1">またはドラッグ＆ドロップ</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                XLSX, XLS, CSV ファイル (最大10MB)
              </p>
            </div>
          </div>
          {file && (
            <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
              選択されたファイル: <strong>{file.name}</strong>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            キャンセル
          </Button>
          <Button onClick={handleImport} disabled={!file || isLoading}>
            {isLoading ? "インポート中..." : "インポート実行"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
