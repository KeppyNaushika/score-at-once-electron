"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
import { AreaType } from "@prisma/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableHeader } from "@/components/ui/table"
import { Grid3X3, Upload, FileImage, Users, Monitor, User } from "lucide-react"
import { toast } from "sonner"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import GridHeader from "./GridHeader"
import StudentGridRow from "./StudentGridRow"

// 型定義
interface Student {
  id: string
  lastName: string
  firstName: string
  lastNameKana: string
  firstNameKana: string
  studentId: string
  attendanceNumber?: number | null
  status?: "participating" | "expected" | "absent"
  customOrder?: number | null
}

interface ConvertedFile {
  id: string
  name: string
  type: string
  size: number
  preview?: string
  studentId?: string
  pageNumber: number
  isSelected: boolean
  pageLabel?: string
  buffer: ArrayBuffer
  originalFileName: string
}

// 配置戦略
type PlacementStrategy = "page-first" | "student-first" | "filename-auto"

// セル状態
interface CellState {
  isEnabled: boolean
  isSkipped: boolean
  file?: ConvertedFile
  isFileDisabled?: boolean // 答案画像の無効化フラグ
}

// 生徒状態
interface StudentState {
  isEnabled: boolean
  isSkipped: boolean
  cells: Record<number, CellState>
}

// ページ状態
interface PageState {
  isEnabled: boolean
  isSkipped: boolean
}

// グリッド状態
interface GridState {
  students: Record<string, StudentState>
  pages: Record<number, PageState>
  placementStrategy: PlacementStrategy
  maxPages: number
}

interface AnswerSheetGridManagerProps {
  projectId: string
  students: Student[]
  files: ConvertedFile[]
  isUploading: boolean
  fileOrder?: "page-then-student" | "student-then-page"
  onFileOrderChange?: (order: "page-then-student" | "student-then-page") => void
  onFilesReorder?: (reorderedFiles: ConvertedFile[]) => void
  onUpload: (
    data: Array<{ file: ConvertedFile; studentId: string; pageNumber: number }>,
  ) => void
}

export default function AnswerSheetGridManager({
  projectId,
  students,
  files,
  isUploading,
  fileOrder = "page-then-student",
  onFileOrderChange,
  onFilesReorder,
  onUpload,
}: AnswerSheetGridManagerProps) {
  // マスター画像の管理
  const [masterImages, setMasterImages] = useState<
    Array<{ id: string; pageNumber: number }>
  >([])
  const [isLoadingMasterImages, setIsLoadingMasterImages] = useState(true)

  // レイアウト領域管理
  const [layoutRegions, setLayoutRegions] = useState<
    Array<{
      id: string
      type: string
      x: number
      y: number
      width: number
      height: number
      masterImageId: string | null
    }>
  >([])
  const [isLoadingRegions, setIsLoadingRegions] = useState(true)

  // 一括プレビューモード管理
  const [globalPreviewMode, setGlobalPreviewMode] = useState<"full" | "name">(
    "full",
  )

  // ドラッグ&ドロップ状態管理
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedFile, setDraggedFile] = useState<ConvertedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // dnd-kit センサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  // マスター画像を取得
  useEffect(() => {
    const loadMasterImages = async () => {
      try {
        setIsLoadingMasterImages(true)
        const images =
          await window.electronAPI.getMasterImagesByProjectId(projectId)
        setMasterImages(images || [])
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load master images:", error)
        }
        setMasterImages([])
      } finally {
        setIsLoadingMasterImages(false)
      }
    }

    if (projectId) {
      loadMasterImages()
    }
  }, [projectId])

  // グリッド状態管理
  const [gridState, setGridState] = useState<GridState>(() => {
    // マスター画像のページ数を使用（初期化時は1、後でuseEffectで更新）
    const maxPages = 1

    // 初期状態: 全生徒・全ページ有効
    const initialStudents: Record<string, StudentState> = {}
    students.forEach((student) => {
      const cells: Record<number, CellState> = {}
      for (let page = 1; page <= maxPages; page++) {
        cells[page] = {
          isEnabled: true,
          isSkipped: false,
        }
      }

      initialStudents[student.id] = {
        isEnabled: student.status !== "absent", // 欠席生徒は既定でオフ
        isSkipped: student.status === "absent",
        cells,
      }

      // Debug log removed for cleaner output
    })

    const initialPages: Record<number, PageState> = {}
    for (let page = 1; page <= maxPages; page++) {
      initialPages[page] = {
        isEnabled: true,
        isSkipped: false,
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("Pages initialized:", initialPages)
    }

    return {
      students: initialStudents,
      pages: initialPages,
      placementStrategy: "filename-auto",
      maxPages,
    }
  })

  // マスター画像が読み込まれたらグリッド状態を更新
  useEffect(() => {
    if (!isLoadingMasterImages && masterImages.length > 0) {
      const actualMaxPages = Math.max(
        ...masterImages.map((img) => img.pageNumber),
      )

      setGridState((prevState) => {
        // 新しいページ状態を作成
        const newPages: Record<number, PageState> = {}
        for (let page = 1; page <= actualMaxPages; page++) {
          newPages[page] = prevState.pages[page] || {
            isEnabled: true,
            isSkipped: false,
          }
        }

        if (process.env.NODE_ENV === "development") {
          console.log("Pages updated after master image load:", newPages)
        }

        // 各生徒のセル状態も更新
        const newStudents: Record<string, StudentState> = {}
        Object.keys(prevState.students).forEach((studentId) => {
          const studentState = prevState.students[studentId]
          const newCells: Record<number, CellState> = {}

          for (let page = 1; page <= actualMaxPages; page++) {
            newCells[page] = studentState.cells[page] || {
              isEnabled: true,
              isSkipped: false,
            }
          }

          newStudents[studentId] = {
            ...studentState,
            cells: newCells,
          }
        })

        return {
          ...prevState,
          students: newStudents,
          pages: newPages,
          maxPages: actualMaxPages,
        }
      })
    }
  }, [isLoadingMasterImages, masterImages])

  // レイアウト領域を取得
  useEffect(() => {
    const loadLayoutRegions = async () => {
      if (!projectId) return

      try {
        setIsLoadingRegions(true)
        const regions =
          await window.electronAPI.getLayoutRegionsByProjectId(projectId)
        if (regions && Array.isArray(regions)) {
          setLayoutRegions(regions)
        } else {
          setLayoutRegions([])
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("Failed to load layout regions:", error)
        }
        setLayoutRegions([])
      } finally {
        setIsLoadingRegions(false)
      }
    }

    loadLayoutRegions()
  }, [projectId])

  // 生徒の有効/無効切り替え
  const toggleStudentEnabled = useCallback((studentId: string) => {
    setGridState((prev) => ({
      ...prev,
      students: {
        ...prev.students,
        [studentId]: {
          ...prev.students[studentId],
          isEnabled: !prev.students[studentId]?.isEnabled,
          isSkipped: prev.students[studentId]?.isEnabled, // 有効→無効の場合はスキップ
        },
      },
    }))
    // 手動切り替え後の自動配置を要求
    setShouldAutoPlace(true)
  }, [])

  // ページの有効/無効切り替え
  const togglePageEnabled = useCallback((pageNumber: number) => {
    setGridState((prev) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [pageNumber]: {
          ...prev.pages[pageNumber],
          isEnabled: !prev.pages[pageNumber]?.isEnabled,
          isSkipped: prev.pages[pageNumber]?.isEnabled,
        },
      },
    }))
    // 手動切り替え後の自動配置を要求
    setShouldAutoPlace(true)
  }, [])

  // セルの有効/無効切り替え
  const toggleCellEnabled = useCallback(
    (studentId: string, pageNumber: number) => {
      setGridState((prev) => {
        const student = prev.students[studentId]
        if (!student) return prev

        const cell = student.cells[pageNumber]
        if (!cell) return prev

        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              cells: {
                ...student.cells,
                [pageNumber]: {
                  ...cell,
                  isEnabled: !cell.isEnabled,
                  isSkipped: cell.isEnabled,
                },
              },
            },
          },
        }
      })
      // 手動切り替え後の自動配置を要求
      setShouldAutoPlace(true)
    },
    [],
  )

  // ファイルの無効化切り替え（セルは有効のまま）
  const toggleFileDisabled = useCallback(
    (studentId: string, pageNumber: number) => {
      setGridState((prev) => {
        const student = prev.students[studentId]
        if (!student) return prev

        const cell = student.cells[pageNumber]
        if (!cell) return prev

        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              cells: {
                ...student.cells,
                [pageNumber]: {
                  ...cell,
                  isFileDisabled: !cell.isFileDisabled,
                },
              },
            },
          },
        }
      })
    },
    [],
  )

  // ファイルの削除
  const removeFileFromCell = useCallback(
    (studentId: string, pageNumber: number) => {
      setGridState((prev) => {
        const student = prev.students[studentId]
        if (!student) return prev

        const cell = student.cells[pageNumber]
        if (!cell) return prev

        return {
          ...prev,
          students: {
            ...prev.students,
            [studentId]: {
              ...student,
              cells: {
                ...student.cells,
                [pageNumber]: {
                  ...cell,
                  file: undefined,
                  isFileDisabled: false,
                },
              },
            },
          },
        }
      })
    },
    [],
  )

  // 自動配置処理
  const autoPlaceFiles = useCallback(() => {
    setGridState((currentGridState) => {
      const enabledStudents = students
        .filter(
          (s) =>
            currentGridState.students[s.id]?.isEnabled &&
            !currentGridState.students[s.id]?.isSkipped,
        )
        .sort((a, b) => {
          // 受験生徒順でソート（customOrder優先、その後出席番号順）
          if (
            a.customOrder !== null &&
            a.customOrder !== undefined &&
            b.customOrder !== null &&
            b.customOrder !== undefined
          ) {
            return a.customOrder - b.customOrder
          }
          if (a.customOrder !== null && a.customOrder !== undefined) return -1
          if (b.customOrder !== null && b.customOrder !== undefined) return 1

          const aNumber = a.attendanceNumber
          const bNumber = b.attendanceNumber
          if (aNumber && bNumber) return aNumber - bNumber
          if (aNumber) return -1
          if (bNumber) return 1

          return `${a.lastName}${a.firstName}`.localeCompare(
            `${b.lastName}${b.firstName}`,
          )
        })

      const enabledPages = Array.from(
        { length: currentGridState.maxPages },
        (_, i) => i + 1,
      ).filter(
        (p) =>
          currentGridState.pages[p]?.isEnabled &&
          !currentGridState.pages[p]?.isSkipped,
      )

      // 有効なセルのリストを生成（配置戦略に基づく順序）
      const validCells: Array<{ studentId: string; pageNumber: number }> = []

      if (fileOrder === "page-then-student") {
        // ページ優先: 1ページ目全員 → 2ページ目全員
        enabledPages.forEach((pageNumber) => {
          enabledStudents.forEach((student) => {
            const cellState =
              currentGridState.students[student.id]?.cells[pageNumber]
            if (cellState?.isEnabled && !cellState.isSkipped) {
              validCells.push({ studentId: student.id, pageNumber })
            }
          })
        })
      } else if (fileOrder === "student-then-page") {
        // 生徒優先: 生徒A全ページ → 生徒B全ページ
        enabledStudents.forEach((student) => {
          enabledPages.forEach((pageNumber) => {
            const cellState =
              currentGridState.students[student.id]?.cells[pageNumber]
            if (cellState?.isEnabled && !cellState.isSkipped) {
              validCells.push({ studentId: student.id, pageNumber })
            }
          })
        })
      }

      // ファイルを順次配置
      const newGridState = { ...currentGridState }

      // 既存の配置をクリア
      Object.keys(newGridState.students).forEach((studentId) => {
        Object.keys(newGridState.students[studentId].cells).forEach(
          (pageStr) => {
            const pageNumber = parseInt(pageStr)
            if (newGridState.students[studentId].cells[pageNumber]) {
              newGridState.students[studentId].cells[pageNumber].file =
                undefined
            }
          },
        )
      })

      // ファイルを順次配置
      files.forEach((file, index) => {
        if (index < validCells.length) {
          const cell = validCells[index]
          if (newGridState.students[cell.studentId]?.cells[cell.pageNumber]) {
            newGridState.students[cell.studentId].cells[cell.pageNumber].file =
              file
          }
        }
      })

      return newGridState
    })
  }, [students, files, fileOrder])

  // ファイルOrder変更時またはファイル追加時に自動配置を実行
  useEffect(() => {
    if (!isLoadingMasterImages && masterImages.length > 0 && files.length > 0) {
      autoPlaceFiles()
    }
  }, [fileOrder, files, isLoadingMasterImages, masterImages, autoPlaceFiles])

  // グリッド状態変更時に自動配置を実行（オンオフ切り替え時の順延処理）
  // 注意: isDragginの依存関係を削除してドラッグ終了後の自動実行を防ぐ
  const [shouldAutoPlace, setShouldAutoPlace] = useState(false)
  
  useEffect(() => {
    if (
      !isLoadingMasterImages &&
      masterImages.length > 0 &&
      files.length > 0 &&
      shouldAutoPlace
    ) {
      autoPlaceFiles()
      setShouldAutoPlace(false)
    }
  }, [
    shouldAutoPlace,
    isLoadingMasterImages,
    masterImages,
    files,
    autoPlaceFiles,
  ])

  // gridStateの変更を検知して親のfiles配列を更新
  useEffect(() => {
    if (!onFilesReorder || isDragging) return // ドラッグ中は更新しない
    
    // gridState内のファイル配置から新しい順序を抽出
    const newFileOrder: ConvertedFile[] = []
    
    // 有効セルの順序でファイルを並べ直す
    const enabledStudents = students
      .filter(s => 
        gridState.students[s.id]?.isEnabled && 
        !gridState.students[s.id]?.isSkipped
      )
      .sort((a, b) => {
        if (a.customOrder !== null && a.customOrder !== undefined && 
            b.customOrder !== null && b.customOrder !== undefined) {
          return a.customOrder - b.customOrder
        }
        if (a.customOrder !== null && a.customOrder !== undefined) return -1
        if (b.customOrder !== null && b.customOrder !== undefined) return 1
        
        const aNumber = a.attendanceNumber
        const bNumber = b.attendanceNumber
        if (aNumber && bNumber) return aNumber - bNumber
        if (aNumber) return -1
        if (bNumber) return 1
        
        return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`)
      })
      
    const enabledPages = Array.from({ length: gridState.maxPages }, (_, i) => i + 1)
      .filter(p => gridState.pages[p]?.isEnabled && !gridState.pages[p]?.isSkipped)
    
    if (fileOrder === "page-then-student") {
      enabledPages.forEach(pageNumber => {
        enabledStudents.forEach(student => {
          const cellState = gridState.students[student.id]?.cells[pageNumber]
          if (cellState?.file && cellState?.isEnabled && !cellState?.isSkipped) {
            newFileOrder.push(cellState.file)
          }
        })
      })
    } else {
      enabledStudents.forEach(student => {
        enabledPages.forEach(pageNumber => {
          const cellState = gridState.students[student.id]?.cells[pageNumber]
          if (cellState?.file && cellState?.isEnabled && !cellState?.isSkipped) {
            newFileOrder.push(cellState.file)
          }
        })
      })
    }
    
    // 配置されていないファイルも追加
    const placedFileIds = new Set(newFileOrder.map(f => f.id))
    files.forEach(file => {
      if (!placedFileIds.has(file.id)) {
        newFileOrder.push(file)
      }
    })
    
    // 順序が実際に変わった場合のみ更新
    const currentOrder = files.map(f => f.id).join(',')
    const newOrder = newFileOrder.map(f => f.id).join(',')
    
    if (currentOrder !== newOrder) {
      if (process.env.NODE_ENV === "development") {
        console.log("📤 Updating parent files order via useEffect:", newFileOrder.map(f => f.id.slice(0, 8)))
      }
      onFilesReorder(newFileOrder)
    }
  }, [gridState, isDragging, onFilesReorder, students, fileOrder, files])

  // ファイル名から生徒を推測
  const findStudentByFilename = useCallback(
    (filename: string) => {
      // 学籍番号での一致を試行
      for (const student of students) {
        if (filename.includes(student.studentId)) {
          return student
        }
      }

      // 姓名での一致を試行（ひらがな・カタカナ・漢字）
      for (const student of students) {
        const patterns = [
          student.lastName + student.firstName,
          student.lastNameKana + student.firstNameKana,
          // その他のパターンも追加可能
        ]

        for (const pattern of patterns) {
          if (filename.includes(pattern)) {
            return student
          }
        }
      }

      return null
    },
    [students],
  )

  // 氏名欄領域をページ別に整理
  const nameRegions = useMemo(() => {
    const regions: Record<
      number,
      { x: number; y: number; width: number; height: number } | null
    > = {}

    for (let page = 1; page <= gridState.maxPages; page++) {
      // 該当ページのmasterImageIdを取得
      const masterImageForPage = masterImages.find(
        (img) => img.pageNumber === page,
      )

      const nameRegionsForPage = layoutRegions.filter(
        (region) =>
          region.type === AreaType.STUDENT_NAME &&
          region.masterImageId === masterImageForPage?.id,
      )

      regions[page] =
        nameRegionsForPage.length > 0
          ? {
              x: nameRegionsForPage[0].x,
              y: nameRegionsForPage[0].y,
              width: nameRegionsForPage[0].width,
              height: nameRegionsForPage[0].height,
            }
          : null
    }
    return regions
  }, [layoutRegions, gridState.maxPages, masterImages])

  // 全セルのIDリストを生成（SortableContext用）
  const allCellIds = useMemo(() => {
    const ids: string[] = []
    students.forEach((student) => {
      for (let page = 1; page <= gridState.maxPages; page++) {
        ids.push(`${student.id}-${page}`)
      }
    })
    return ids
  }, [students, gridState.maxPages])

  // ドラッグ開始処理
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      setActiveId(active.id as string)
      setIsDragging(true)

      // ドラッグされているファイルを特定（UUIDにハイフンが含まれるため最後のハイフンで分割）
      const idParts = active.id as string
      const lastHyphenIndex = idParts.lastIndexOf("-")
      const studentId = idParts.substring(0, lastHyphenIndex)
      const pageNumberStr = idParts.substring(lastHyphenIndex + 1)
      const pageNumber = parseInt(pageNumberStr)
      const studentState = gridState.students[studentId]
      const cellState = studentState?.cells[pageNumber]

      if (cellState?.file) {
        setDraggedFile(cellState.file)
      }
    },
    [gridState],
  )

  // ドラッグ終了処理
  const handleDragEnd = (event: DragEndEvent) => {
      if (process.env.NODE_ENV === "development") {
        console.log("🔄 Drag operation starting")
      }

      const { active, over } = event

      setActiveId(null)
      setDraggedFile(null)
      setIsDragging(false)

      if (!over) {
        if (process.env.NODE_ENV === "development") {
          console.log("❌ No drop target")
        }
        return
      }
      
      if (active.id === over.id) {
        if (process.env.NODE_ENV === "development") {
          console.log("❌ Same cell, no move needed")
        }
        return
      }
      
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Valid drop target detected")
      }

      // ドラッグ元とドラッグ先のセル情報を取得（UUIDにハイフンが含まれるため最後のハイフンで分割）
      const activeIdParts = active.id as string
      const activeLastHyphenIndex = activeIdParts.lastIndexOf("-")
      const activeStudentId = activeIdParts.substring(0, activeLastHyphenIndex)
      const activePageStr = activeIdParts.substring(activeLastHyphenIndex + 1)

      const overIdParts = over.id as string
      const overLastHyphenIndex = overIdParts.lastIndexOf("-")
      const overStudentId = overIdParts.substring(0, overLastHyphenIndex)
      const overPageStr = overIdParts.substring(overLastHyphenIndex + 1)

      const activePageNumber = parseInt(activePageStr)
      const overPageNumber = parseInt(overPageStr)


      // 戦略別のドラッグ制約チェック
      // ページごと並べる戦略：ページ間移動も許可（横方向移動）

      if (
        fileOrder === "student-then-page" &&
        activeStudentId !== overStudentId
      ) {
        // 生徒ごと並べる戦略：同じ生徒内でのみ移動可能
        toast.info("生徒ごと並べる戦略では、同じ生徒内でのみ移動できます")
        return
      }

      // 正しい順番の入れ替えロジックを実装
      if (process.env.NODE_ENV === "development") {
        console.log("📍 About to call setGridState")
      }
      setGridState((prev) => {
        if (process.env.NODE_ENV === "development") {
          console.log("📍 Inside setGridState callback")
        }
        // 完全に新しいオブジェクトを作成
        const newState = {
          ...prev,
          students: { ...prev.students },
          pages: { ...prev.pages }
        }

        // 現在のファイル配置を順序付きで取得
        const currentFileOrder: Array<{
          file: ConvertedFile
          studentId: string
          pageNumber: number
          cellIndex: number
        }> = []

        // 有効セルのリストを戦略に応じて生成
        const validCells: Array<{ studentId: string; pageNumber: number }> = []
        const enabledStudents = students
          .filter(
            (s) =>
              newState.students[s.id]?.isEnabled &&
              !newState.students[s.id]?.isSkipped,
          )
          .sort((a, b) => {
            if (
              a.customOrder !== null &&
              a.customOrder !== undefined &&
              b.customOrder !== null &&
              b.customOrder !== undefined
            ) {
              return a.customOrder - b.customOrder
            }
            if (a.customOrder !== null && a.customOrder !== undefined) return -1
            if (b.customOrder !== null && b.customOrder !== undefined) return 1

            const aNumber = a.attendanceNumber
            const bNumber = b.attendanceNumber
            if (aNumber && bNumber) return aNumber - bNumber
            if (aNumber) return -1
            if (bNumber) return 1

            return `${a.lastName}${a.firstName}`.localeCompare(
              `${b.lastName}${b.firstName}`,
            )
          })

        const enabledPages = Array.from(
          { length: newState.maxPages },
          (_, i) => i + 1,
        ).filter(
          (p) => newState.pages[p]?.isEnabled && !newState.pages[p]?.isSkipped,
        )

        if (fileOrder === "page-then-student") {
          // ページ優先: 1ページ目全員 → 2ページ目全員
          enabledPages.forEach((pageNumber) => {
            enabledStudents.forEach((student) => {
              const cellState = newState.students[student.id]?.cells[pageNumber]
              if (cellState?.isEnabled && !cellState.isSkipped) {
                validCells.push({ studentId: student.id, pageNumber })
              }
            })
          })
        } else {
          // 生徒優先: 生徒A全ページ → 生徒B全ページ
          enabledStudents.forEach((student) => {
            enabledPages.forEach((pageNumber) => {
              const cellState = newState.students[student.id]?.cells[pageNumber]
              if (cellState?.isEnabled && !cellState.isSkipped) {
                validCells.push({ studentId: student.id, pageNumber })
              }
            })
          })
        }

        // 現在の配置から順序付きファイルリストを作成
        validCells.forEach((cell, cellIndex) => {
          const cellState =
            newState.students[cell.studentId]?.cells[cell.pageNumber]
          if (cellState?.file) {
            currentFileOrder.push({
              file: cellState.file,
              studentId: cell.studentId,
              pageNumber: cell.pageNumber,
              cellIndex,
            })
          }
        })

        // ドラッグ元とドラッグ先のインデックスを取得
        const fromIndex = currentFileOrder.findIndex(
          (item) =>
            item.studentId === activeStudentId &&
            item.pageNumber === activePageNumber,
        )

        // ドラッグ先のセルが有効かチェック
        const overStudentState = newState.students[overStudentId]
        const overCellState = overStudentState?.cells[overPageNumber]
        const overPageState = newState.pages[overPageNumber]

        // Drop target validation removed for cleaner output

        const isOverCellValid =
          overStudentState?.isEnabled &&
          !overStudentState?.isSkipped &&
          overCellState?.isEnabled &&
          !overCellState?.isSkipped &&
          overPageState?.isEnabled &&
          !overPageState?.isSkipped

        if (!isOverCellValid) {
          if (process.env.NODE_ENV === "development") {
            console.log("❌ Invalid drop target")
          }
          return prev
        }

        // 有効なセルの中でのドラッグ先インデックスを計算
        const targetCellIndex = validCells.findIndex(
          (cell) =>
            cell.studentId === overStudentId &&
            cell.pageNumber === overPageNumber,
        )

        // ドラッグ先のセルにすでにファイルがある場合、そのファイルのインデックスを取得
        const existingFileAtTarget = currentFileOrder.findIndex(
          (item) =>
            item.studentId === overStudentId &&
            item.pageNumber === overPageNumber,
        )

        let toIndex: number
        if (existingFileAtTarget !== -1) {
          // 既存ファイルがある場合は、そのファイルと入れ替え
          toIndex = existingFileAtTarget
        } else {
          // ファイルがない場合は、そのセル位置に対応するインデックスを計算
          // validCells配列内でより前にあるファイルの数を数える
          let filesBefore = 0
          for (let i = 0; i < targetCellIndex; i++) {
            const cell = validCells[i]
            const cellState = newState.students[cell.studentId]?.cells[cell.pageNumber]
            if (cellState?.file) {
              filesBefore++
            }
          }
          toIndex = filesBefore
        }

        if (fromIndex === -1 || toIndex === -1) {
          if (process.env.NODE_ENV === "development") {
            console.log("❌ Invalid indices:", { fromIndex, toIndex })
          }
          return prev
        }

        if (fromIndex === toIndex) {
          if (process.env.NODE_ENV === "development") {
            console.log("❌ Same indices, no move needed:", { fromIndex, toIndex })
          }
          return prev
        }

        if (process.env.NODE_ENV === "development") {
          console.log("🔀 Performing array move:", { fromIndex, toIndex })
        }
        
        // arrayMoveを使用して順序を変更
        const reorderedFiles = arrayMove(currentFileOrder, fromIndex, toIndex)

        // 全セルをクリア - ディープコピーで新しいオブジェクト作成
        Object.keys(newState.students).forEach((studentId) => {
          newState.students[studentId] = {
            ...newState.students[studentId],
            cells: { ...newState.students[studentId].cells }
          }
          
          Object.keys(newState.students[studentId].cells).forEach((pageStr) => {
            const pageNumber = parseInt(pageStr)
            if (newState.students[studentId].cells[pageNumber]) {
              newState.students[studentId].cells[pageNumber] = {
                ...newState.students[studentId].cells[pageNumber],
                file: undefined,
              }
            }
          })
        })

        // 新しい順序でファイルを配置（fileDataに含まれる位置情報を使用）
        reorderedFiles.forEach((fileData) => {
          if (newState.students[fileData.studentId]?.cells[fileData.pageNumber]) {
            // ファイルオブジェクトのコピーを作成して参照を変更
            const fileCopy = { ...fileData.file }
            
            newState.students[fileData.studentId].cells[fileData.pageNumber] = {
              ...newState.students[fileData.studentId].cells[fileData.pageNumber],
              file: fileCopy,
            }
          }
        })
        
        if (process.env.NODE_ENV === "development") {
          console.log("🎯 State update completed")
        }
        return newState
      })
      
      
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Drag operation completed successfully")
      }
    }

  // アップロード実行
  const handleUpload = useCallback(() => {
    const uploadData: Array<{
      file: ConvertedFile
      studentId: string
      pageNumber: number
    }> = []

    // 有効なセルからアップロードデータを生成
    students.forEach((student) => {
      const studentState = gridState.students[student.id]
      if (!studentState?.isEnabled || studentState.isSkipped) return

      Object.entries(studentState.cells).forEach(([pageStr, cellState]) => {
        const pageNumber = parseInt(pageStr)
        if (!cellState.isEnabled || cellState.isSkipped || !cellState.file)
          return

        uploadData.push({
          file: cellState.file,
          studentId: student.id,
          pageNumber,
        })
      })
    })

    onUpload(uploadData)
  }, [students, gridState, onUpload])

  // 統計計算
  const stats = useMemo(() => {
    const enabledStudents = Object.values(gridState.students).filter(
      (s) => s.isEnabled && !s.isSkipped,
    ).length
    const enabledPages = Object.values(gridState.pages).filter(
      (p) => p.isEnabled && !p.isSkipped,
    ).length
    const totalCells = enabledStudents * enabledPages

    let filledCells = 0
    Object.values(gridState.students).forEach((student) => {
      if (!student.isEnabled || student.isSkipped) return
      Object.values(student.cells).forEach((cell) => {
        if (cell.isEnabled && !cell.isSkipped && cell.file) {
          filledCells++
        }
      })
    })

    return {
      enabledStudents,
      enabledPages,
      totalCells,
      filledCells,
      completionRate:
        totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0,
    }
  }, [gridState])

  // ローディング中の表示
  if (isLoadingMasterImages) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center">
            <div className="text-muted-foreground">
              模範解答のページ情報を読み込み中...
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // マスター画像がない場合
  if (!masterImages || masterImages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="py-8 text-center">
            <div className="text-muted-foreground">
              模範解答がアップロードされていません。
              <br />
              まず「模範解答アップロード」ページで模範解答をアップロードしてください。
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={allCellIds}
          strategy={verticalListSortingStrategy}
        >
        {/* 表形式グリッド */}
        <Card className="flex flex-col h-full">
          <CardHeader className="flex-shrink-0">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5" />
                生徒と答案の対応
              </span>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-none bg-transparent text-slate-600"
                >
                  {stats.filledCells}/{stats.totalCells} セル
                </Badge>
                <Badge
                  variant={
                    stats.completionRate === 100 ? "default" : "secondary"
                  }
                  className="border-none bg-transparent text-slate-600"
                >
                  {stats.completionRate}% 完了
                </Badge>
              </div>
            </CardTitle>
            {onFileOrderChange && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={
                      fileOrder === "page-then-student" ? "default" : "outline"
                    }
                    onClick={() => onFileOrderChange("page-then-student")}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <FileImage className="h-4 w-4" />
                    ページごと並べる
                  </Button>
                  <Button
                    variant={
                      fileOrder === "student-then-page" ? "default" : "outline"
                    }
                    onClick={() => onFileOrderChange("student-then-page")}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <Users className="h-4 w-4" />
                    生徒ごと並べる
                  </Button>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || stats.filledCells === 0}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading
                    ? "アップロード中..."
                    : `${stats.filledCells}件をアップロード`}
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* 一括操作ボタン */}
            <div className="flex items-center justify-between gap-2 border-b p-4 flex-shrink-0">
              <div className="text-muted-foreground text-sm">
                💡
                画像をドラッグして順序変更（ページ間移動も可能）、Alt+クリックでセル除外
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  一括プレビュー:
                </span>
                <Button
                  size="sm"
                  variant={globalPreviewMode === "full" ? "default" : "outline"}
                  onClick={() => setGlobalPreviewMode("full")}
                  className="flex items-center gap-1"
                >
                  <Monitor className="h-4 w-4" />
                  全体
                </Button>
                <Button
                  size="sm"
                  variant={globalPreviewMode === "name" ? "default" : "outline"}
                  onClick={() => setGlobalPreviewMode("name")}
                  className="flex items-center gap-1"
                >
                  <User className="h-4 w-4" />
                  氏名欄
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-auto rounded border select-none min-h-0">
              <Table className="select-none">
                <TableHeader className="sticky top-0 z-10">
                  <GridHeader
                    maxPages={gridState.maxPages}
                    pageStates={gridState.pages}
                    onTogglePage={togglePageEnabled}
                  />
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <StudentGridRow
                      key={student.id}
                      student={student}
                      maxPages={gridState.maxPages}
                      studentState={gridState.students[student.id]}
                      pageStates={gridState.pages}
                      nameRegions={nameRegions}
                      globalPreviewMode={globalPreviewMode}
                      onToggleStudent={() => toggleStudentEnabled(student.id)}
                      onToggleCell={(pageNumber) =>
                        toggleCellEnabled(student.id, pageNumber)
                      }
                      onToggleFileDisabled={(pageNumber) =>
                        toggleFileDisabled(student.id, pageNumber)
                      }
                      onRemoveFile={(pageNumber) =>
                        removeFileFromCell(student.id, pageNumber)
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* ドラッグプレビュー */}
        <DragOverlay>
          {activeId && draggedFile ? (
            <div className="h-24 w-32 rounded border-2 border-blue-400 bg-white p-1 shadow-lg">
              <div className="h-16 w-full overflow-hidden rounded border bg-gray-50">
                {draggedFile.preview && (
                  <img
                    src={draggedFile.preview}
                    alt="ドラッグ中"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <div className="mt-1 truncate text-center text-xs">
                {draggedFile.originalFileName}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </SortableContext>
    </DndContext>
    </div>
  )
}
