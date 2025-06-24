"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { convertPdfToImages } from "@/lib/pdfConverter"
import type { UploadAnswerSheetFileData } from "@/types/electron"
import { arrayMove } from '@dnd-kit/sortable'
import { DragEndEvent } from '@dnd-kit/core'

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
  masterImageId?: string | null
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
  status?: 'participating' | 'expected' | 'absent'
  customOrder?: number | null
  attendanceNumber?: number | null
}

interface UseAnswerSheetUploadProps {
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

export function useAnswerSheetUpload({
  projectId,
  students,
  onUploadComplete,
}: UseAnswerSheetUploadProps) {
  const [files, setFiles] = useState<ConvertedFile[]>([])
  const [studentsWithAnswers, setStudentsWithAnswers] = useState<StudentWithAnswers[]>([])
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

  const [isClient, setIsClient] = useState(false)
  
  // クライアントサイドでのみフラグを設定
  useEffect(() => {
    setIsClient(true)
  }, [])

  // 生徒の既存答案をチェック & レイアウト領域を取得
  useEffect(() => {
    const checkExistingAnswers = async () => {
      try {
        const result = await window.electronAPI.getAnswerSheetsByProjectId(projectId)
        const existingAnswers = result.success ? result.answerSheets : []

        const studentsWithAnswerStatus = students.map((student) => {
          const hasExistingAnswers =
            existingAnswers?.some((answer: any) => answer.studentId === student.id) ?? false
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
        if (result && Array.isArray(result)) {
          setLayoutRegions(result.map((r: any) => ({...r, masterImageId: r.masterImageId || undefined})) || [])
        } else if (result && typeof result === 'object' && 'success' in result && (result as any).success) {
          const regions = (result as any).layoutRegions || []
          setLayoutRegions(regions.map((r: any) => ({...r, masterImageId: r.masterImageId || undefined})))
        }
      } catch (error) {
        console.error("Error fetching layout regions:", error)
      }
    }

    const fetchMasterImages = async () => {
      try {
        const result = await window.electronAPI.getMasterImagesByProjectId(projectId)
        if (result && Array.isArray(result)) {
          setMasterImages(result || [])
        } else if (result && typeof result === 'object' && 'success' in result && (result as any).success) {
          setMasterImages((result as any).masterImages || [])
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
    if (!isClient) {
      throw new Error('PDF変換はクライアントサイドでのみ利用可能です')
    }
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
      if (!isClient) {
        throw new Error('PDF変換はクライアントサイドでのみ利用可能です')
      }
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
      
      // ページ範囲フィルタリング
      const actualPageNumber = pageIndex + 1
      if (pageRange === 'specific') {
        const allowedPages = parsePageRange(specificPages)
        if (!allowedPages.includes(actualPageNumber)) {
          continue // このページをスキップ
        }
      }
      
      const convertedFile: ConvertedFile = {
        id: `${Date.now()}-${Math.random()}-${pageIndex}`,
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
      newFiles.push(convertedFile)
    }

    setFiles(prev => [...prev, ...newFiles])
    setMaxPages(prev => Math.max(prev, convertedImages.length))
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
            .filter(s => (s.status || 'participating') === 'participating') // 受験する生徒のみ
            .sort((a, b) => {
              // customOrderが設定されている場合はそれを優先
              const aOrder = a.customOrder ?? (a as any).customOrder
              const bOrder = b.customOrder ?? (b as any).customOrder
              if (aOrder !== null && aOrder !== undefined &&
                  bOrder !== null && bOrder !== undefined) {
                return aOrder - bOrder
              }
              if (aOrder !== null && aOrder !== undefined) return -1
              if (bOrder !== null && bOrder !== undefined) return 1

              // customOrderが未設定の場合は出席番号順をフォールバック
              const aAttendance = a.attendanceNumber ?? (a as any).attendanceNumber
              const bAttendance = b.attendanceNumber ?? (b as any).attendanceNumber
              if (aAttendance && bAttendance) {
                return aAttendance - bAttendance
              }
              if (aAttendance) return -1
              if (bAttendance) return 1
              return 0
            })

          // ファイル順序に応じて自動割り当て
          filesWithStudentGuess = allConvertedFiles.map((file, index) => {
            if (fileOrder === 'student-then-page') {
              // 生徒ごと、ページ連番（デフォルト）
              // 例: 田中p1, 田中p2, 田中p3, 山田p1, 山田p2, 山田p3...
              const studentIndex = Math.floor(index / maxPages)
              const pageNumber = (index % maxPages) + 1

              if (studentIndex < sortedStudents.length && pageNumber <= maxPages) {
                file.studentId = sortedStudents[studentIndex].id
                file.pageNumber = pageNumber
              }
            } else {
              // ページごと生徒連番（page-then-student）
              // 例: 田中p1, 山田p1, 佐藤p1, 田中p2, 山田p2, 佐藤p2...
              const pageNumber = Math.floor(index / sortedStudents.length) + 1
              const studentIndex = index % sortedStudents.length

              if (pageNumber <= maxPages && studentIndex < sortedStudents.length) {
                file.studentId = sortedStudents[studentIndex].id
                file.pageNumber = pageNumber
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
    [studentsWithAnswers, assignmentMode, fileOrder, maxPages, sortMode, layoutRegions, masterImages, isClient, pageRange, specificPages],
  )

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

  const getStudentName = (studentId?: string) => {
    if (!studentId) return "生徒を選択"
    const student = studentsWithAnswers.find((s) => s.id === studentId)
    return student
      ? `${student.lastName} ${student.firstName} (${student.studentId})`
      : "生徒を選択"
  }

  // ファイル順序の再計算（生徒無効化時のスキップ処理）
  const reassignStudentsToFiles = useCallback(() => {
    if (assignmentMode !== 'auto') return

    const enabledStudents = studentsWithAnswers
      .filter(s => s.isSelected && s.status === 'participating')
      .sort((a, b) => {
        if (a.customOrder !== null && a.customOrder !== undefined &&
            b.customOrder !== null && b.customOrder !== undefined) {
          return a.customOrder - b.customOrder
        }
        if (a.customOrder !== null && a.customOrder !== undefined) return -1
        if (b.customOrder !== null && b.customOrder !== undefined) return 1

        if (a.attendanceNumber && b.attendanceNumber) {
          return a.attendanceNumber - b.attendanceNumber
        }
        if (a.attendanceNumber) return -1
        if (b.attendanceNumber) return 1
        return 0
      })

    setFiles(prevFiles => {
      return prevFiles.map((file, index) => {
        if (fileOrder === 'student-then-page') {
          const studentIndex = Math.floor(index / maxPages)
          if (studentIndex < enabledStudents.length) {
            return { ...file, studentId: enabledStudents[studentIndex].id }
          }
        } else {
          const studentIndex = index % enabledStudents.length
          if (studentIndex < enabledStudents.length) {
            return { ...file, studentId: enabledStudents[studentIndex].id }
          }
        }
        return { ...file, studentId: undefined }
      })
    })
  }, [assignmentMode, studentsWithAnswers, fileOrder, maxPages])

  // 生徒選択状態が変わったときに再割り当て
  useEffect(() => {
    reassignStudentsToFiles()
  }, [studentsWithAnswers.map(s => s.isSelected).join(','), reassignStudentsToFiles])

  // ファイルのDnD処理
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    setFiles(items => {
      const oldIndex = items.findIndex(item => item.id === active.id)
      const newIndex = items.findIndex(item => item.id === over.id)

      const newFiles = arrayMove(items, oldIndex, newIndex)

      // 自動モードの場合、移動後に生徒を再割り当て
      if (assignmentMode === 'auto') {
        const enabledStudents = studentsWithAnswers
          .filter(s => s.isSelected && s.status === 'participating')
          .sort((a, b) => {
            if (a.customOrder !== null && a.customOrder !== undefined &&
                b.customOrder !== null && b.customOrder !== undefined) {
              return a.customOrder - b.customOrder
            }
            if (a.customOrder !== null && a.customOrder !== undefined) return -1
            if (b.customOrder !== null && b.customOrder !== undefined) return 1

            if (a.attendanceNumber && b.attendanceNumber) {
              return a.attendanceNumber - b.attendanceNumber
            }
            if (a.attendanceNumber) return -1
            if (b.attendanceNumber) return 1
            return 0
          })

        return newFiles.map((file, index) => {
          if (fileOrder === 'student-then-page') {
            const studentIndex = Math.floor(index / maxPages)
            if (studentIndex < enabledStudents.length) {
              return { ...file, studentId: enabledStudents[studentIndex].id }
            }
          } else {
            const studentIndex = index % enabledStudents.length
            if (studentIndex < enabledStudents.length) {
              return { ...file, studentId: enabledStudents[studentIndex].id }
            }
          }
          return { ...file, studentId: undefined }
        })
      }

      return newFiles
    })
  }

  const handleUpload = async () => {
    const selectedFiles = files.filter((f) => f.isSelected)

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

  return {
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

    // Setters
    setSelectedTab,
    setPageRange,
    setSpecificPages,
    setFileOrder,
    setAssignmentMode,
    setSortMode,
    setShowPasswordDialog,
    setCurrentPdfFile,
    setPasswordError,
    setIsConverting,

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
    selectedFilesCount: files.filter((f) => f.isSelected).length,
    selectedStudentsCount: studentsWithAnswers.filter((s) => s.isSelected).length,
  }
}