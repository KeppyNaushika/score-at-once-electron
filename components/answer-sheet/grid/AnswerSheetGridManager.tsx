"use client"

import { useState, useCallback, useMemo, useEffect } from "react"
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
  DragOverEvent,
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


// 無効化状態管理（table-dnd-kit-test準拠のflat構造）
interface DisabledState {
  rows: Set<number>      // 生徒行の無効化
  cols: Set<number>      // ページ列の無効化
  positions: Set<number> // 個別セル位置の無効化
  files: Set<string>     // ファイル無効化（ゴミ箱用）
}

// セルデータ型（table-dnd-kit-test準拠）
interface CellData {
  type: "disabled" | "file" | "empty"
  position: number
  file?: ConvertedFile
}

interface AnswerSheetGridManagerProps {
  projectId: string
  students: Student[]
  files: ConvertedFile[]
  isUploading: boolean
  fileOrder?: "row-first" | "col-first"  // table-dnd-kit-test準拠
  onFileOrderChange?: (order: "row-first" | "col-first") => void
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
  fileOrder = "row-first",
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

  // 一括プレビューモード管理
  const [globalPreviewMode, setGlobalPreviewMode] = useState<"full" | "name">(
    "full",
  )

  // ドラッグ&ドロップ状態管理
  const [activeId, setActiveId] = useState<string | null>(null)
  const [draggedFile, setDraggedFile] = useState<ConvertedFile | null>(null)

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
        setMasterImages([])
      } finally {
        setIsLoadingMasterImages(false)
      }
    }

    if (projectId) {
      loadMasterImages()
    }
  }, [projectId])

  // 無効化状態管理（table-dnd-kit-test準拠のflat構造）
  const [disabledState, setDisabledState] = useState<DisabledState>(() => {
    const initialState: DisabledState = {
      rows: new Set<number>(),
      cols: new Set<number>(),
      positions: new Set<number>(),
      files: new Set<string>(),
    }
    
    // 欠席生徒の行を初期無効化（ソート前のインデックスで設定）
    students.forEach((student, index) => {
      if (student.status === "absent") {
        initialState.rows.add(index)
      }
    })
    
    return initialState
  })
  
  // 最大ページ数管理
  const [maxPages, setMaxPages] = useState(1)

  // マスター画像が読み込まれたら最大ページ数を更新
  useEffect(() => {
    if (!isLoadingMasterImages && masterImages.length > 0) {
      const actualMaxPages = Math.max(
        ...masterImages.map((img) => img.pageNumber),
      )
      setMaxPages(actualMaxPages)
    }
  }, [isLoadingMasterImages, masterImages])

  // レイアウト領域を取得
  useEffect(() => {
    const loadLayoutRegions = async () => {
      if (!projectId) return

      try {
        const regions =
          await window.electronAPI.getLayoutRegionsByProjectId(projectId)
        if (regions && Array.isArray(regions)) {
          setLayoutRegions(regions)
        } else {
          setLayoutRegions([])
        }
      } catch (error) {
        setLayoutRegions([])
      }
    }

    loadLayoutRegions()
  }, [projectId])

  // セル位置が無効化されているかチェック（table-dnd-kit-test準拠）
  const isPositionDisabled = useCallback((position: number) => {
    const row = Math.floor(position / maxPages)
    const col = position % maxPages

    return (
      disabledState.rows.has(row) ||
      disabledState.cols.has(col) ||
      disabledState.positions.has(position)
    )
  }, [disabledState, maxPages])

  // 有効なファイルのみ取得（table-dnd-kit-test準拠）
  const getEnabledFiles = useCallback(() => {
    return files.filter(file => !disabledState.files.has(file.id))
  }, [files, disabledState])

  // 無効化されたファイルのみ取得（table-dnd-kit-test準拠）
  const getDisabledFiles = useCallback(() => {
    return files.filter(file => disabledState.files.has(file.id))
  }, [files, disabledState])

  // 生徒行の有効/無効切り替え（table-dnd-kit-test準拠）
  const toggleStudentEnabled = useCallback((rowIndex: number) => {
    setDisabledState((prev) => {
      const newRows = new Set(prev.rows)
      if (newRows.has(rowIndex)) {
        newRows.delete(rowIndex)
      } else {
        newRows.add(rowIndex)
      }
      return { ...prev, rows: newRows }
    })
  }, [])

  // ページ列の有効/無効切り替え（table-dnd-kit-test準拠）
  const togglePageEnabled = useCallback((colIndex: number) => {
    setDisabledState((prev) => {
      const newCols = new Set(prev.cols)
      if (newCols.has(colIndex)) {
        newCols.delete(colIndex)
      } else {
        newCols.add(colIndex)
      }
      return { ...prev, cols: newCols }
    })
  }, [])

  // セル位置の有効/無効切り替え（table-dnd-kit-test準拠）
  const toggleCellEnabled = useCallback(
    (studentIndex: number, pageIndex: number) => {
      const position = studentIndex * maxPages + pageIndex
      setDisabledState((prev) => {
        const newPositions = new Set(prev.positions)
        if (newPositions.has(position)) {
          newPositions.delete(position)
        } else {
          newPositions.add(position)
        }
        return { ...prev, positions: newPositions }
      })
    },
    [maxPages],
  )

  // ファイルの無効化切り替え（table-dnd-kit-test準拠）
  const toggleFileDisabled = useCallback(
    (fileId: string) => {
      setDisabledState((prev) => {
        const newFiles = new Set(prev.files)
        if (newFiles.has(fileId)) {
          newFiles.delete(fileId)
        } else {
          newFiles.add(fileId)
        }
        return { ...prev, files: newFiles }
      })
    },
    [],
  )

  // ファイルの削除（ゴミ箱に移動、table-dnd-kit-test準拠）
  const removeFileFromCell = useCallback(
    (fileId: string) => {
      setDisabledState((prev) => {
        const newFiles = new Set(prev.files)
        newFiles.add(fileId)
        return { ...prev, files: newFiles }
      })
    },
    [],
  )

  // customOrder順にソートされた生徒リスト
  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => {
      // customOrderで並び替え（小さい値が先）
      // customOrderが未定義またはnullの場合は、学籍番号の数値として比較
      const aOrder = a.customOrder !== undefined && a.customOrder !== null ? a.customOrder : 999999
      const bOrder = b.customOrder !== undefined && b.customOrder !== null ? b.customOrder : 999999
      
      // customOrderが同じ場合は姓名でソート
      if (aOrder === bOrder) {
        const aName = `${a.lastName}${a.firstName}`
        const bName = `${b.lastName}${b.firstName}`
        return aName.localeCompare(bName, 'ja')
      }
      
      return aOrder - bOrder
    })
  }, [students])

  // テーブルデータを配置戦略に応じて再構成（table-dnd-kit-test準拠）
  const getTableData = useCallback((): CellData[][] => {
    const enabledFiles = getEnabledFiles()
    let enabledFileIndex = 0

    const getNextFile = () => {
      if (enabledFileIndex < enabledFiles.length) {
        return enabledFiles[enabledFileIndex++]
      }
      return null
    }

    if (fileOrder === "row-first") {
      // 行優先配置（ページ優先）
      const result: CellData[][] = []
      for (let row = 0; row < sortedStudents.length; row++) {
        const rowFiles: CellData[] = []
        for (let col = 0; col < maxPages; col++) {
          const position = row * maxPages + col

          if (isPositionDisabled(position)) {
            // 無効セル：赤い背景で表示、配置はスキップ
            rowFiles.push({ type: "disabled", position })
          } else {
            const nextFile = getNextFile()
            if (nextFile) {
              // 有効セル：次のファイルを配置
              rowFiles.push({ type: "file", file: nextFile, position })
            } else {
              // ファイル不足：空きとして表示
              rowFiles.push({ type: "empty", position })
            }
          }
        }
        result.push(rowFiles)
      }
      return result
    } else {
      // 列優先配置（生徒優先）
      const result: CellData[][] = Array.from({ length: sortedStudents.length }, (_, row) =>
        Array.from({ length: maxPages }, (_, col) => {
          const position = row * maxPages + col
          if (isPositionDisabled(position)) {
            return { type: "disabled", position }
          } else {
            return { type: "empty", position }
          }
        }),
      )

      // 列優先でファイルを配置
      for (let col = 0; col < maxPages; col++) {
        for (let row = 0; row < sortedStudents.length; row++) {
          const position = row * maxPages + col
          if (!isPositionDisabled(position)) {
            const nextFile = getNextFile()
            if (nextFile) {
              result[row][col] = { type: "file", file: nextFile, position }
            }
          }
        }
      }

      return result
    }
  }, [sortedStudents, maxPages, fileOrder, isPositionDisabled, getEnabledFiles])

  // getTableDataは動的計算なので自動配置useEffectは不要

  // table-dnd-kit-test準拠：親のfiles配列更新は不要（動的計算のため）

  // 氏名欄領域をページ別に整理
  const nameRegions = useMemo(() => {
    const regions: Record<
      number,
      { x: number; y: number; width: number; height: number } | null
    > = {}

    for (let page = 1; page <= maxPages; page++) {
      // 該当ページのmasterImageIdを取得
      const masterImageForPage = masterImages.find(
        (img) => img.pageNumber === page,
      )

      const nameRegionsForPage = layoutRegions.filter(
        (region) =>
          region.type === "STUDENT_NAME" &&
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
  }, [layoutRegions, maxPages, masterImages])

  // 全セルのIDリストを生成（SortableContext用）
  const allCellIds = useMemo(() => {
    const ids: string[] = []
    // 有効なファイルのIDを追加
    getEnabledFiles().forEach(file => {
      ids.push(file.id)
    })
    return ids
  }, [getEnabledFiles])

  // コンテナ判定関数（table-dnd-kit-test準拠）
  const findContainer = useCallback((id: string) => {
    // コンテナ自体の場合
    if (id === "trash-area" || id === "trash-popover-trigger") return "trash"

    // テーブルファイルの場合
    const enabledFile = getEnabledFiles().find((file) => file.id === id)
    if (enabledFile) {
      return "main"
    }

    // ゴミ箱ファイルの場合
    const disabledFile = getDisabledFiles().find((file) => file.id === id)
    if (disabledFile) {
      return "trash"
    }

    return null
  }, [getEnabledFiles, getDisabledFiles])

  // ドラッグ開始処理（table-dnd-kit-test準拠）
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      setActiveId(active.id as string)

      // ドラッグされているファイルを特定
      const activeId = active.id as string
      const foundFile = files.find((file) => file.id === activeId) || null
      setDraggedFile(foundFile)
    },
    [files],
  )

  // ドラッグオーバー処理（table-dnd-kit-test準拠）
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id.toString()
    const overId = over.id.toString()

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    if (activeContainer !== overContainer && overContainer && activeContainer) {
      // コンテナ間移動：即座にdisabledStateを更新
      setDisabledState((prev) => {
        const newFiles = new Set(prev.files)
        if (activeContainer === "main" && overContainer === "trash") {
          newFiles.add(activeId)
        } else if (activeContainer === "trash" && overContainer === "main") {
          newFiles.delete(activeId)
        }
        return { ...prev, files: newFiles }
      })
    }
  }, [findContainer])

  // ドラッグ終了処理（table-dnd-kit-test準拠）
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    setActiveId(null)
    setDraggedFile(null)
    
    if (!over) {
      return
    }

    const activeId = active.id.toString()
    const overId = over.id.toString()

    if (activeId === overId) {
      return
    }

    const activeContainer = findContainer(activeId)
    const overContainer = findContainer(overId)

    // コンテナ間移動はすでにhandleDragOverで処理済み
    // 同一コンテナ内での並び替えのみここで処理
    if (activeContainer === overContainer && activeContainer === "main" && onFilesReorder) {
      const oldIndex = files.findIndex((file) => file.id === activeId)
      const newIndex = files.findIndex((file) => file.id === overId)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedFiles = arrayMove(files, oldIndex, newIndex)
        onFilesReorder(reorderedFiles)
      }
    }
  }, [files, onFilesReorder, findContainer])

  // アップロード実行
  const handleUpload = useCallback(() => {
    const uploadData: Array<{
      file: ConvertedFile
      studentId: string
      pageNumber: number
    }> = []

    // 有効なセルからアップロードデータを生成
    students.forEach((student, studentIndex) => {
      // 生徒行が無効化されている場合はスキップ
      if (disabledState.rows.has(studentIndex)) return

      for (let pageIndex = 0; pageIndex < maxPages; pageIndex++) {
        const position = studentIndex * maxPages + pageIndex
        if (isPositionDisabled(position)) continue

        const tableData = getTableData()
        const cellData = tableData[studentIndex]?.[pageIndex]
        if (cellData?.type === "file" && cellData.file) {
          uploadData.push({
            file: cellData.file,
            studentId: student.id,
            pageNumber: pageIndex + 1,
          })
        }
      }
    })

    onUpload(uploadData)
  }, [students, maxPages, disabledState, isPositionDisabled, getTableData, onUpload])

  // 統計計算
  const stats = useMemo(() => {
    const enabledStudents = students.filter((_, index) => !disabledState.rows.has(index)).length
    const enabledPages = Array.from({length: maxPages}, (_, index) => index)
      .filter(pageIndex => !disabledState.cols.has(pageIndex)).length
    const totalCells = enabledStudents * enabledPages

    let filledCells = 0
    const tableData = getTableData()
    tableData.forEach(row => {
      row.forEach(cellData => {
        if (cellData.type === "file") {
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
  }, [students, maxPages, disabledState, getTableData])

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
        onDragOver={handleDragOver}
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
                      fileOrder === "col-first" ? "default" : "outline"
                    }
                    onClick={() => onFileOrderChange("col-first")}
                    className="flex items-center gap-2"
                    size="sm"
                  >
                    <FileImage className="h-4 w-4" />
                    ページごと並べる
                  </Button>
                  <Button
                    variant={
                      fileOrder === "row-first" ? "default" : "outline"
                    }
                    onClick={() => onFileOrderChange("row-first")}
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
                    maxPages={maxPages}
                    pageStates={disabledState.cols}
                    onTogglePage={togglePageEnabled}
                  />
                </TableHeader>
                <TableBody>
                  {sortedStudents.map((student, studentIndex) => (
                    <StudentGridRow
                      key={student.id}
                      student={student}
                      studentIndex={studentIndex}
                      maxPages={maxPages}
                      isStudentDisabled={disabledState.rows.has(studentIndex)}
                      tableData={getTableData()[studentIndex]}
                      nameRegions={nameRegions}
                      globalPreviewMode={globalPreviewMode}
                      onToggleStudent={() => toggleStudentEnabled(studentIndex)}
                      onToggleCell={(pageNumber) =>
                        toggleCellEnabled(studentIndex, pageNumber - 1)
                      }
                      onToggleFileDisabled={(pageNumber) => {
                        const cellData = getTableData()[studentIndex][pageNumber - 1]
                        if (cellData?.file) {
                          toggleFileDisabled(cellData.file.id)
                        }
                      }}
                      onRemoveFile={(pageNumber) => {
                        const cellData = getTableData()[studentIndex][pageNumber - 1]
                        if (cellData?.file) {
                          removeFileFromCell(cellData.file.id)
                        }
                      }}
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
