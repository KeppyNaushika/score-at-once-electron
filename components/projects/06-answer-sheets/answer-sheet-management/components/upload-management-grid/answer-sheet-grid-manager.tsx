"use client"

import { closestCenter, DndContext, DragOverlay } from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FileImage, Grid3X3, Upload, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { GridHeader } from "@/components/projects/06-answer-sheets/answer-sheet-management/components/upload-management-grid/grid-header"
import { StudentGridRow } from "@/components/projects/06-answer-sheets/answer-sheet-management/components/upload-management-grid/student-grid-row"
import type {
  UnifiedFile,
  UnifiedStudent,
} from "@/components/projects/06-answer-sheets/answer-sheet-management/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHeader } from "@/components/ui/table"

interface AnswerSheetGridManagerProps {
  projectId: string
  students: UnifiedStudent[]
  files: UnifiedFile[]
  isUploading: boolean
  fileOrder?: "page-first" | "student-first"
  onFileOrderChange?: (order: "page-first" | "student-first") => void
  onFilesReorder?: (reorderedFiles: UnifiedFile[]) => void
  onUpload: (
    data: Array<{ file: UnifiedFile; studentId: string; pageNumber: number }>,
  ) => void
}

export function AnswerSheetGridManager({
  projectId,
  students,
  files,
  isUploading,
  fileOrder = "page-first",
  onFileOrderChange,
  onFilesReorder,
  onUpload,
}: AnswerSheetGridManagerProps) {
  // State管理
  const [masterImages, setMasterImages] = useState<
    Array<{ id: string; pageNumber: number }>
  >([])
  const [studentStates, setStudentStates] = useState<Set<string>>(new Set())
  const [pageStates, setPageStates] = useState<Set<number>>(new Set())
  const [cellStates, setCellStates] = useState<Set<string>>(new Set())
  const [fileStates, setFileStates] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)

  // 模範解答情報を取得
  useEffect(() => {
    const loadMasterImages = async () => {
      try {
        const images =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        setMasterImages(images || [])
      } catch (error) {
        console.error("Failed to load master images:", error)
      }
    }
    loadMasterImages()
  }, [projectId])

  // 欠席者の自動無効化
  useEffect(() => {
    const absentStudentIds = students
      .filter((student) => student.status === "absent")
      .map((student) => student.id)

    if (absentStudentIds.length > 0) {
      setStudentStates((prev) => {
        const newStates = new Set(prev)
        absentStudentIds.forEach((id) => newStates.add(id))
        return newStates
      })
    }
  }, [students])

  // 最大ページ数
  const maxPages = useMemo(() => {
    return masterImages.length > 0
      ? Math.max(...masterImages.map((img) => img.pageNumber))
      : 3 // デフォルト
  }, [masterImages])

  // ソート済み生徒リスト
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
      return aOrder - bOrder
    })
  }, [students])

  // 状態切り替え関数
  const toggleStudentState = useCallback((studentId: string) => {
    setStudentStates((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(studentId)) {
        newSet.delete(studentId)
      } else {
        newSet.add(studentId)
      }
      return newSet
    })
  }, [])

  const togglePageState = useCallback((pageIndex: number) => {
    setPageStates((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(pageIndex)) {
        newSet.delete(pageIndex)
      } else {
        newSet.add(pageIndex)
      }
      return newSet
    })
  }, [])

  const toggleCellState = useCallback(
    (studentId: string, pageNumber: number) => {
      const cellKey = `${studentId}-${pageNumber}`
      setCellStates((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(cellKey)) {
          newSet.delete(cellKey)
        } else {
          newSet.add(cellKey)
        }
        return newSet
      })
    },
    [],
  )

  const toggleFileState = useCallback((fileId: string) => {
    setFileStates((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(fileId)) {
        newSet.delete(fileId)
      } else {
        newSet.add(fileId)
      }
      return newSet
    })
  }, [])

  const removeFile = useCallback(
    (fileId: string) => {
      if (onFilesReorder) {
        const newFiles = files.filter((file) => file.id !== fileId)
        onFilesReorder(newFiles)
      }
    },
    [files, onFilesReorder],
  )

  const handleCellClick = useCallback(
    (_studentId: string, _pageNumber: number) => {
      // セルクリック処理
    },
    [],
  )

  // アップロード処理
  const handleUpload = useCallback(() => {
    const uploadData: Array<{
      file: UnifiedFile
      studentId: string
      pageNumber: number
    }> = []

    // 有効なファイルから配置データを生成
    const enabledFiles = files.filter((file) => !fileStates.has(file.id))

    enabledFiles.forEach((file) => {
      if (file.studentId && file.pageNumber) {
        uploadData.push({
          file,
          studentId: file.studentId,
          pageNumber: file.pageNumber,
        })
      }
    })

    if (uploadData.length === 0) {
      toast.error("アップロードするファイルがありません")
      return
    }

    onUpload(uploadData)
  }, [files, fileStates, onUpload])

  // 統計情報
  const stats = useMemo(() => {
    const enabledFiles = files.filter((file) => !fileStates.has(file.id))
    const disabledFiles = files.filter((file) => fileStates.has(file.id))

    return {
      totalFiles: files.length,
      enabledFiles: enabledFiles.length,
      disabledFiles: disabledFiles.length,
      totalStudents: sortedStudents.length,
      disabledStudents: studentStates.size,
      totalPages: maxPages,
      disabledPages: pageStates.size,
    }
  }, [
    files,
    fileStates,
    sortedStudents.length,
    studentStates.size,
    maxPages,
    pageStates.size,
  ])

  // 模範解答が存在しない場合
  if (maxPages === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center text-gray-500">
            <FileImage className="mx-auto mb-4 h-12 w-12 text-gray-400" />
            <p className="text-lg">模範解答が登録されていません</p>
            <p className="text-sm">まず模範解答をアップロードしてください</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={({ active }) => {
        const file = files.find((f) => f.id === active.id)
        setActiveFile(file || null)
      }}
      onDragEnd={() => setActiveFile(null)}
    >
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2">
              <Grid3X3 className="h-5 w-5" />
              答案配置管理
            </CardTitle>

            <div className="flex flex-wrap items-center gap-4">
              {/* ファイル順序切り替え */}
              {onFileOrderChange && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">配置順序:</span>
                  <div className="flex rounded-md border">
                    <Button
                      variant={fileOrder === "page-first" ? "default" : "ghost"}
                      size="sm"
                      onClick={() => onFileOrderChange("page-first")}
                      className="rounded-r-none border-r"
                    >
                      ページ順
                    </Button>
                    <Button
                      variant={
                        fileOrder === "student-first" ? "default" : "ghost"
                      }
                      size="sm"
                      onClick={() => onFileOrderChange("student-first")}
                      className="rounded-l-none"
                    >
                      生徒順
                    </Button>
                  </div>
                </div>
              )}

              {/* アップロードボタン */}
              <Button
                onClick={handleUpload}
                disabled={isUploading || stats.enabledFiles === 0}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {isUploading ? "アップロード中..." : "アップロード実行"}
              </Button>
            </div>
          </div>

          {/* 統計情報 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <FileImage className="h-4 w-4" />
              <span>
                ファイル: {stats.enabledFiles}/{stats.totalFiles}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>
                生徒: {stats.totalStudents - stats.disabledStudents}/
                {stats.totalStudents}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary">
                ページ: {stats.totalPages - stats.disabledPages}/
                {stats.totalPages}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 overflow-auto p-4">
          <SortableContext
            items={files.map((file) => file.id)}
            strategy={verticalListSortingStrategy}
          >
            <Table>
              <TableHeader>
                <GridHeader
                  maxPages={maxPages}
                  pageStates={pageStates}
                  onTogglePage={togglePageState}
                />
              </TableHeader>
              <TableBody>
                {sortedStudents.map((student) => (
                  <StudentGridRow
                    key={student.id}
                    student={student}
                    maxPages={maxPages}
                    pageStates={pageStates}
                    cellStates={cellStates}
                    fileStates={fileStates}
                    files={files}
                    isStudentDisabled={studentStates.has(student.id)}
                    onToggleStudent={() => toggleStudentState(student.id)}
                    onToggleCell={toggleCellState}
                    onToggleFile={toggleFileState}
                    onRemoveFile={removeFile}
                    onCellClick={handleCellClick}
                  />
                ))}
              </TableBody>
            </Table>
          </SortableContext>
        </CardContent>
      </Card>

      {/* ドラッグオーバーレイ */}
      <DragOverlay dropAnimation={null}>
        {activeFile ? (
          <div className="scale-110 rotate-3 transform rounded-lg border-2 border-blue-400 bg-white p-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 flex-shrink-0 rounded bg-blue-200" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-gray-800">
                  {activeFile.name.split(" - ページ")[0] || activeFile.name}
                </div>
                <div className="text-sm text-gray-500">
                  {(activeFile.size / 1024).toFixed(1)}KB
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
