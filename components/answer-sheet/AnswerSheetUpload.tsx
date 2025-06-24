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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { PasswordDialog } from "@/components/ui/password-dialog"
import {
  AlertCircle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileImage,
  FileText,
  GripVertical,
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
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
    status?: 'participating' | 'expected' | 'absent'
    customOrder?: number | null
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

interface LayoutRegion {
  id: string
  type: string
  x: number
  y: number
  width: number
  height: number
  label: string
  masterImageId?: string
}

interface MasterImage {
  id: string
  pageNumber: number
  path: string
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
  const [pageRange, setPageRange] = useState<'all' | 'specific'>('all')
  const [specificPages, setSpecificPages] = useState<string>('1')
  const [fileOrder, setFileOrder] = useState<'page-then-student' | 'student-then-page'>('student-then-page')
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto')
  const [sortMode, setSortMode] = useState<'natural' | 'alphabetical' | 'upload-order'>('natural')
  
  // パスワード関連の状態
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPdfFile, setCurrentPdfFile] = useState<File | null>(null)
  const [passwordError, setPasswordError] = useState<string>('')
  const [isPasswordProcessing, setIsPasswordProcessing] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [layoutRegions, setLayoutRegions] = useState<LayoutRegion[]>([])
  const [masterImages, setMasterImages] = useState<MasterImage[]>([])
  
  const router = useRouter()
  const { convertPdfToImages } = usePdfConverter()

  // 生徒の既存答案をチェック & レイアウト領域を取得
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

    const fetchLayoutRegions = async () => {
      try {
        const result = await window.electronAPI.getLayoutRegionsByProjectId(projectId)
        if (result.success) {
          setLayoutRegions(result.layoutRegions || [])
        }
      } catch (error) {
        console.error("Error fetching layout regions:", error)
      }
    }

    const fetchMasterImages = async () => {
      try {
        const result = await window.electronAPI.getMasterImagesByProjectId(projectId)
        if (result.success) {
          setMasterImages(result.masterImages || [])
        }
      } catch (error) {
        console.error("Error fetching master images:", error)
      }
    }

    checkExistingAnswers()
    fetchLayoutRegions()
    fetchMasterImages()
  }, [students, projectId])

  // PDFのパスワード処理付き変換関数
  const convertPdfWithPasswordHandling = async (file: File, password?: string) => {
    try {
      return await convertPdfToImages(file, password)
    } catch (error: any) {
      if (error.message === 'password-required') {
        // パスワードが必要な場合、ダイアログを表示
        setCurrentPdfFile(file)
        setPasswordError('')
        setShowPasswordDialog(true)
        throw new Error('password-dialog-shown')
      } else if (error.message === 'invalid-password') {
        // パスワードが間違っている場合
        setPasswordError('パスワードが正しくありません。再度入力してください。')
        throw new Error('invalid-password')
      } else {
        throw error
      }
    }
  }

  // パスワードダイアログでのパスワード送信処理
  const handlePasswordSubmit = async (password: string) => {
    if (!currentPdfFile) return

    setIsPasswordProcessing(true)
    setPasswordError('')

    try {
      const convertedImages = await convertPdfToImages(currentPdfFile, password)
      
      // パスワード処理成功、ファイル処理を続行
      setShowPasswordDialog(false)
      setCurrentPdfFile(null)
      
      // PDFファイルをpendingFilesから取得して処理を継続
      const filesWithPassword = pendingFiles.filter(f => f !== currentPdfFile)
      setPendingFiles(filesWithPassword)
      
      // 変換されたファイルを処理
      await processPdfConversion(currentPdfFile, convertedImages)
      
    } catch (error: any) {
      if (error.message === 'invalid-password') {
        setPasswordError('パスワードが正しくありません。再度入力してください。')
      } else {
        setPasswordError(`PDFの処理中にエラーが発生しました: ${error.message}`)
      }
    } finally {
      setIsPasswordProcessing(false)
    }
  }

  // PDF変換後の処理
  const processPdfConversion = async (file: File, convertedImages: any[]) => {
    const newFiles: ConvertedFile[] = []
    
    for (let pageIndex = 0; pageIndex < convertedImages.length; pageIndex++) {
      const converted = convertedImages[pageIndex]
      const convertedFile: ConvertedFile = {
        id: `${Date.now()}-${Math.random()}-${pageIndex}`,
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
      newFiles.push(convertedFile)
    }
    
    setFiles(prev => [...prev, ...newFiles])
    setMaxPages(prev => Math.max(prev, convertedImages.length))
  }

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      setIsConverting(true)
      setPendingFiles(acceptedFiles)

      try {
        let allConvertedFiles: ConvertedFile[] = []
        let fileIndex = 0

        for (const file of acceptedFiles) {
          if (file.type === "application/pdf") {
            try {
              // PDF → PNG変換（パスワード処理を含む）
              const convertedImages = await convertPdfWithPasswordHandling(file)

              for (
                let pageIndex = 0;
                pageIndex < convertedImages.length;
                pageIndex++
              ) {
                const converted = convertedImages[pageIndex]
                
                // ページ範囲フィルタリング
                const actualPageNumber = pageIndex + 1
                if (pageRange === 'specific') {
                  const allowedPages = parsePageRange(specificPages)
                  if (!allowedPages.includes(actualPageNumber)) {
                    continue // このページをスキップ
                  }
                }
                
                const convertedFile: ConvertedFile = {
                  id: `${Date.now()}-${fileIndex}-${pageIndex}`,
                  name: converted.name,
                  type: converted.type,
                  size: converted.buffer.byteLength,
                  buffer: converted.buffer,
                  preview: URL.createObjectURL(
                    new Blob([converted.buffer], { type: converted.type }),
                  ),
                  pageNumber: actualPageNumber, // 実際のページ番号を設定
                  isSelected: true,
                  originalFileName: file.name,
                  pageLabel: `${file.name} - ページ ${actualPageNumber}`,
                }

                allConvertedFiles.push(convertedFile)
              }

              setMaxPages((prev) => Math.max(prev, convertedImages.length))
            } catch (error: any) {
              if (error.message === 'password-dialog-shown') {
                // パスワードダイアログが表示された場合、処理を中断
                setIsConverting(false)
                return
              } else {
                // その他のエラーは通常通り処理
                console.error(`PDF変換エラー (${file.name}):`, error)
                toast.error(`PDF変換エラー: ${file.name} - ${error.message}`)
                continue
              }
            }
          } else {
            // 画像ファイル（ページ番号は1固定）
            const buffer = await file.arrayBuffer()
            const actualPageNumber = 1 // 画像ファイルは1ページ扱い
            
            // ページ範囲フィルタリング（画像ファイルの場合）
            if (pageRange === 'specific') {
              const allowedPages = parsePageRange(specificPages)
              if (!allowedPages.includes(actualPageNumber)) {
                fileIndex++
                continue // このファイルをスキップ
              }
            }
            
            const convertedFile: ConvertedFile = {
              id: `${Date.now()}-${fileIndex}`,
              name: file.name,
              type: file.type,
              size: file.size,
              buffer,
              preview: URL.createObjectURL(file),
              pageNumber: actualPageNumber,
              isSelected: true,
              originalFileName: file.name,
              pageLabel: file.name,
            }

            allConvertedFiles.push(convertedFile)
          }

          fileIndex++
        }

        // ファイルソート機能
        const sortFiles = (files: ConvertedFile[], mode: string) => {
          switch (mode) {
            case 'natural': {
              // 自然順ソート（スキャン連番を考慮：scan001.pdf < scan002.pdf < scan10.pdf）
              const collator = new Intl.Collator(undefined, {
                numeric: true,
                sensitivity: 'base'
              })
              return files.sort((a, b) => 
                collator.compare(a.originalFileName.toLowerCase(), b.originalFileName.toLowerCase())
              )
            }
            case 'alphabetical': {
              // アルファベット順ソート
              return files.sort((a, b) => 
                a.originalFileName.toLowerCase().localeCompare(b.originalFileName.toLowerCase())
              )
            }
            case 'upload-order':
            default: {
              // アップロード順（元の順序）
              return files
            }
          }
        }

        // ファイルをソート（スキャン連番対応）
        allConvertedFiles = sortFiles(allConvertedFiles, sortMode)

        // 自動・手動どちらの場合でも生徒を割り当て
        let filesWithStudentGuess = allConvertedFiles
        
        if (assignmentMode === 'auto') {
          // 受験生徒順序（customOrder）にソートされた生徒リスト
          const sortedStudents = [...students]
            .filter(s => s.status === 'participating') // 受験する生徒のみ
            .sort((a, b) => {
              // customOrderが設定されている場合はそれを優先
              if (a.customOrder !== null && a.customOrder !== undefined && 
                  b.customOrder !== null && b.customOrder !== undefined) {
                return a.customOrder - b.customOrder
              }
              if (a.customOrder !== null && a.customOrder !== undefined) return -1
              if (b.customOrder !== null && b.customOrder !== undefined) return 1
              
              // customOrderが未設定の場合は出席番号順をフォールバック
              if (a.attendanceNumber && b.attendanceNumber) {
                return a.attendanceNumber - b.attendanceNumber
              }
              if (a.attendanceNumber) return -1
              if (b.attendanceNumber) return 1
              return 0
            })
          
          // ファイル順序に応じて自動割り当て
          filesWithStudentGuess = allConvertedFiles.map((file, index) => {
            if (fileOrder === 'student-then-page') {
              // 生徒ごと、ページ連番（デフォルト）
              const studentIndex = Math.floor(index / maxPages)
              const pageNumber = (index % maxPages) + 1
              
              if (studentIndex < sortedStudents.length) {
                file.studentId = sortedStudents[studentIndex].id
                // ページ番号は既に設定済みなので変更しない
                // file.pageNumber = pageNumber
              }
            } else {
              // 各ページごと生徒連番
              const pageNumber = Math.floor(index / sortedStudents.length) + 1
              const studentIndex = index % sortedStudents.length
              
              if (pageNumber <= maxPages && studentIndex < sortedStudents.length) {
                file.studentId = sortedStudents[studentIndex].id
                // ページ番号は既に設定済みなので変更しない
                // file.pageNumber = pageNumber
              }
            }
            
            return file
          })
        }
        
        // 手動モードの場合、または自動割り当てで未割り当てのファイルがある場合、
        // ファイル名から生徒を推測（改善版）
        filesWithStudentGuess = allConvertedFiles.map((file) => {
          // 自動モードで既に割り当て済みの場合はスキップ
          if (assignmentMode === 'auto' && file.studentId) {
            return file
          }
          
          const fileName = file.name.toLowerCase()
          const matchedStudent = studentsWithAnswers.find((student) => {
            const studentName = `${student.lastName}${student.firstName}`.toLowerCase()
            const studentNameKana = `${student.lastNameKana}${student.firstNameKana}`.toLowerCase()
            const studentId = student.studentId.toLowerCase()
            
            // より精密なマッチング：完全一致を優先
            const exactMatches = [
              fileName.includes(studentId),
              fileName.includes(studentName),
              fileName.includes(studentNameKana)
            ]
            
            // 部分一致も考慮（姓のみ、名のみ）
            const partialMatches = [
              fileName.includes(student.lastName.toLowerCase()),
              fileName.includes(student.firstName.toLowerCase()),
              fileName.includes(student.lastNameKana.toLowerCase()),
              fileName.includes(student.firstNameKana.toLowerCase())
            ]
            
            return exactMatches.some(match => match) || partialMatches.filter(match => match).length >= 2
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
    [studentsWithAnswers, convertPdfToImages, assignmentMode, fileOrder, maxPages, sortMode, layoutRegions, masterImages],
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
    if (!studentId) return "生徒を選択"
    const student = studentsWithAnswers.find((s) => s.id === studentId)
    return student
      ? `${student.lastName} ${student.firstName} (${student.studentId})`
      : "生徒を選択"
  }
  
  // ページ範囲パース関数
  const parsePageRange = (pageStr: string): number[] => {
    const pages: number[] = []
    const parts = pageStr.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed.includes('-')) {
        // 範囲指定（例: 3-5）
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()))
        if (!isNaN(start) && !isNaN(end) && start <= end) {
          for (let i = start; i <= end; i++) {
            pages.push(i)
          }
        }
      } else {
        // 単一ページ（例: 1）
        const pageNum = parseInt(trimmed)
        if (!isNaN(pageNum)) {
          pages.push(pageNum)
        }
      }
    }
    
    return [...new Set(pages)].sort((a, b) => a - b) // 重複除去＆ソート
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            アップロード
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <FileImage className="h-4 w-4" />
            ファイル・生徒管理 ({files.length}ファイル, {selectedStudentsCount}生徒)
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
          
          {/* バッチ読み込み設定 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">バッチ読み込み設定</CardTitle>
              <CardDescription>
                複数ファイルの一括読み込み時の動作を設定します
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* 割り当てモード */}
                <div className="space-y-2">
                  <Label>生徒への割り当て方法</Label>
                  <Select
                    value={assignmentMode}
                    onValueChange={(value: 'auto' | 'manual') => setAssignmentMode(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">自動割り当て（出席番号順）</SelectItem>
                      <SelectItem value="manual">手動割り当て（ファイル名推測）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* ファイル順序（自動割り当て時のみ） */}
                {assignmentMode === 'auto' && (
                  <div className="space-y-2">
                    <Label>ファイルの並び順</Label>
                    <Select
                      value={fileOrder}
                      onValueChange={(value: 'page-then-student' | 'student-then-page') => setFileOrder(value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="student-then-page">
                          生徒ごと→ページ順（推奨）
                        </SelectItem>
                        <SelectItem value="page-then-student">
                          ページごと→生徒順
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {fileOrder === 'student-then-page' 
                        ? '例: 田中p1, 田中p2, 山田p1, 山田p2...'
                        : '例: 田中p1, 山田p1, 田中p2, 山田p2...'}
                    </p>
                  </div>
                )}
                
                {/* ファイル並び替え */}
                <div className="space-y-2">
                  <Label>ファイルの並び替え</Label>
                  <Select
                    value={sortMode}
                    onValueChange={(value: 'natural' | 'alphabetical' | 'upload-order') => setSortMode(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">自然順（推奨）</SelectItem>
                      <SelectItem value="alphabetical">アルファベット順</SelectItem>
                      <SelectItem value="upload-order">アップロード順</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {sortMode === 'natural' 
                      ? 'スキャン連番を考慮: scan001.pdf < scan002.pdf < scan10.pdf'
                      : sortMode === 'alphabetical'
                      ? '標準的なアルファベット順でソート'
                      : 'ファイルを選択した順序で処理'}
                  </p>
                </div>
                
                {/* ページ範囲 */}
                <div className="space-y-2">
                  <Label>読み込むページ</Label>
                  <Select
                    value={pageRange}
                    onValueChange={(value: 'all' | 'specific') => setPageRange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">すべてのページ</SelectItem>
                      <SelectItem value="specific">特定のページのみ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 特定ページ指定 */}
                {pageRange === 'specific' && (
                  <div className="space-y-2">
                    <Label>ページ番号</Label>
                    <Input
                      type="text"
                      value={specificPages}
                      onChange={(e) => setSpecificPages(e.target.value)}
                      placeholder="例: 1,3-5,7"
                    />
                    <p className="text-xs text-muted-foreground">
                      カンマ区切りで指定。範囲指定も可能です
                    </p>
                  </div>
                )}
              </div>
              
              {assignmentMode === 'auto' && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-sm">
                    <strong className="text-blue-900">自動割り当てモード:</strong>{' '}
                    <span className="text-blue-700">
                      ファイルは出席番号順に自動的に生徒へ割り当てられます。
                      受験する生徒のみが対象となり、欠席者はスキップされます。
                    </span>
                  </p>
                </div>
              )}
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

                      {/* プレビュー画像（氏名枠表示付き） */}
                      <div className="flex-shrink-0 relative">
                        {file.preview ? (
                          <div className="relative">
                            <img
                              src={file.preview}
                              alt={file.name}
                              className="h-12 w-12 rounded border object-cover"
                            />
                            {/* 氏名枠オーバーレイ（ページ対応 + 拡大表示） */}
                            {(() => {
                              // 現在のファイルのページ番号に対応するマスター画像を取得
                              const targetMasterImage = masterImages.find(
                                img => img.pageNumber === file.pageNumber
                              )
                              
                              console.log('Debug - File:', file.name, 'Page:', file.pageNumber)
                              console.log('Debug - Master Images:', masterImages.map(img => ({id: img.id, pageNumber: img.pageNumber})))
                              console.log('Debug - Target Master Image:', targetMasterImage)
                              console.log('Debug - All Layout Regions:', layoutRegions.map(r => ({id: r.id, type: r.type, masterImageId: r.masterImageId})))
                              
                              // ページ対応の氏名領域を取得
                              const nameRegionsForPage = layoutRegions.filter(region => 
                                region.type === 'STUDENT_NAME' && 
                                region.masterImageId === targetMasterImage?.id
                              )
                              
                              console.log('Debug - Name Regions for Page:', nameRegionsForPage)
                              
                              // 氏名領域がある場合は拡大表示、ない場合は全体表示
                              if (nameRegionsForPage.length > 0) {
                                // 氏名領域のみを拡大表示
                                return nameRegionsForPage.map(region => (
                                  <div
                                    key={region.id}
                                    className="absolute border-2 border-green-500 bg-green-500/20"
                                    style={{
                                      left: `${region.x * 100}%`,
                                      top: `${region.y * 100}%`,
                                      width: `${region.width * 100}%`,
                                      height: `${region.height * 100}%`,
                                    }}
                                    title={`ページ${file.pageNumber}: ${region.label}`}
                                  >
                                    <div className="absolute -top-5 left-0 text-xs bg-green-500 text-white px-1 rounded">
                                      {region.label}
                                    </div>
                                  </div>
                                ))
                              } else {
                                // 氏名領域がない場合、全体を表示（フォールバック）
                                return (
                                  <div 
                                    className="absolute inset-0 border border-gray-400 bg-gray-400/5"
                                    title={`ページ${file.pageNumber}: 氏名領域未設定 (マスター画像: ${targetMasterImage?.id || '未登録'})`}
                                  >
                                    <div className="absolute -top-5 left-0 text-xs bg-gray-500 text-white px-1 rounded">
                                      氏名枠なし (P{file.pageNumber})
                                    </div>
                                  </div>
                                )
                              }
                            })()}
                          </div>
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
                            <SelectValue placeholder="生徒を選択">
                              {file.studentId ? getStudentName(file.studentId) : "生徒を選択"}
                            </SelectValue>
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

      {/* パスワード入力ダイアログ */}
      <PasswordDialog
        isOpen={showPasswordDialog}
        onClose={() => {
          setShowPasswordDialog(false)
          setCurrentPdfFile(null)
          setPasswordError('')
          setIsConverting(false)
        }}
        onSubmit={handlePasswordSubmit}
        fileName={currentPdfFile?.name || ''}
        error={passwordError}
        isLoading={isPasswordProcessing}
      />
    </div>
  )
}
