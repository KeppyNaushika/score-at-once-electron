import type { ExtendedDisabledState } from "@/components/projects/06-answer-sheets/answer-sheet-table/types"
import type {
  PlacementStrategy,
  UnifiedFile,
  UnifiedStudent,
} from "@/types/answer-sheet.types"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

export function useDragDrop(
  files: UnifiedFile[],
  onFilesChange: (files: UnifiedFile[]) => void,
  getEnabledFiles: () => UnifiedFile[],
  getDisabledFiles: () => UnifiedFile[],
  disabledState: ExtendedDisabledState,
  setDisabledState: (
    state:
      | ExtendedDisabledState
      | ((prev: ExtendedDisabledState) => ExtendedDisabledState),
  ) => void,
  students?: UnifiedStudent[],
  masterImageCount?: number,
  mode?: "upload" | "view",
  fileOrder?: PlacementStrategy,
  onReloadData?: () => void,
  onUpdatePendingChanges?: (
    changedFiles: Array<{ fileId: string; fromState: any; toState: any }>,
  ) => void,
) {
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)
  const [isDraggingFromTrash, setIsDraggingFromTrash] = useState(false)

  // ファイル状態管理用の型定義
  type FileState = {
    fileId: string
    studentId: string | null
    pageNumber: number
  }

  // メイン状態: 3つ組を管理
  const fileStatesRef = useRef<FileState[]>([])
  const initialFileStatesRef = useRef<FileState[]>([])
  const prevFileOrderRef = useRef<PlacementStrategy | undefined>(undefined)

  // 3つ組からDnD配列を構築する関数（戦略ベース順序）
  const buildDnDArrayFromFileStates = useCallback(
    (fileStates: FileState[], strategy: PlacementStrategy): UnifiedFile[] => {
      if (!students || !masterImageCount || fileStates.length === 0) return []

      // 生徒のソート（受験生徒順：customOrder準拠）
      const sortedStudents = [...students].sort((a, b) => {
        const aOrder = a.customOrder ?? Number.MAX_SAFE_INTEGER
        const bOrder = b.customOrder ?? Number.MAX_SAFE_INTEGER
        return aOrder - bOrder
      })

      // 配置戦略に基づいて論理位置の順序を決定（Math.floor不使用）
      const orderedPositions: Array<{
        studentId: string | null
        pageNumber: number
      }> = []

      if (strategy === "student-first") {
        // 生徒順: s1p1, s1p2, s2p1, s2p2, ...
        sortedStudents.forEach((student) => {
          for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
            orderedPositions.push({
              studentId: student.id,
              pageNumber: pageNum,
            })
          }
        })
      } else {
        // ページ順: s1p1, s2p1, s3p1, ..., s1p2, s2p2, s3p2, ...
        for (let pageNum = 1; pageNum <= masterImageCount; pageNum++) {
          sortedStudents.forEach((student) => {
            orderedPositions.push({
              studentId: student.id,
              pageNumber: pageNum,
            })
          })
        }
      }

      // 論理位置の順序に基づいてファイルを配置
      const orderedFiles: UnifiedFile[] = []

      orderedPositions.forEach((position) => {
        // 3つ組から対応するファイルを検索
        const matchingFileState = fileStates.find(
          (state) =>
            state.studentId === position.studentId &&
            state.pageNumber === position.pageNumber,
        )

        if (matchingFileState) {
          // 元のfiles配列から実際のUnifiedFileオブジェクトを取得
          const actualFile = files.find(
            (file) => file.id === matchingFileState.fileId,
          )
          if (actualFile) {
            orderedFiles.push(actualFile)
          }
        }
      })

      return orderedFiles
    },
    [students, masterImageCount, files],
  )

  // DnD配列から3つ組を更新する関数（ファイル実データを直接使用）
  const updateFileStatesFromDnDArray = useCallback(
    (dndArray: UnifiedFile[]): FileState[] => {
      // ファイルの実データをそのまま使用（推測ではない）
      return dndArray.map((file) => ({
        fileId: file.id,
        studentId: file.studentId || null, // ファイルの実データ
        pageNumber: file.pageNumber, // ファイルの実データ
      }))
    },
    [],
  )

  // ファイル状態を比較して変更されたファイルを検知する関数
  const compareFileStates = useCallback(
    (initialStates: FileState[], currentStates: FileState[]) => {
      const changedFiles: Array<{
        fileId: string
        fromState: FileState
        toState: FileState
      }> = []

      // 各ファイルについて、初期状態と現在状態を比較
      currentStates.forEach((currentState) => {
        const initialState = initialStates.find(
          (state) => state.fileId === currentState.fileId,
        )

        if (initialState) {
          // studentId または pageNumber が変わった場合
          if (
            initialState.studentId !== currentState.studentId ||
            initialState.pageNumber !== currentState.pageNumber
          ) {
            changedFiles.push({
              fileId: currentState.fileId,
              fromState: initialState,
              toState: currentState,
            })
          }
        }
      })

      return changedFiles
    },
    [],
  )

  // 1. 初期化: DB → 3つ組（実データから直接生成）
  useEffect(() => {
    if (
      mode === "view" &&
      files.length > 0 &&
      fileStatesRef.current.length === 0
    ) {
      // DBから直接3つ組を生成（推測ではなく実データ）
      const states: FileState[] = files.map((file) => ({
        fileId: file.id,
        studentId: file.studentId || null, // DBの実際の値
        pageNumber: file.pageNumber, // DBの実際の値
      }))

      fileStatesRef.current = [...states]
      initialFileStatesRef.current = [...states] // 初期状態保存
    }
  }, [mode, files.length, files])

  // 2. 戦略変更時: 初期状態の3つ組 → DnD配列再構築
  useEffect(() => {
    if (
      initialFileStatesRef.current.length > 0 &&
      prevFileOrderRef.current !== fileOrder
    ) {
      const newFiles = buildDnDArrayFromFileStates(
        initialFileStatesRef.current,
        fileOrder || "page-first",
      )
      if (newFiles.length > 0) {
        onFilesChange(newFiles)
        // 戦略変更後、現在の3つ組も初期状態に戻す
        fileStatesRef.current = [...initialFileStatesRef.current]
      }
      prevFileOrderRef.current = fileOrder
    }
  }, [fileOrder, buildDnDArrayFromFileStates, onFilesChange])

  // 確認モードでの答案配置交換（安全なユニーク制約回避）
  const swapAnswerSheetInDatabase = useCallback(
    async (file1: UnifiedFile, file2: UnifiedFile) => {
      // APIが利用可能かチェック
      if (
        !window.electronAPI ||
        !window.electronAPI.swapAnswerSheetPlacements
      ) {
        console.error(
          "swapAnswerSheetPlacements API is not available. Please restart the Electron app.",
        )
        toast.error("APIが利用できません。アプリを再起動してください。")
        return
      }

      try {
        const result = await window.electronAPI.swapAnswerSheetPlacements(
          file1.id,
          file2.id,
        )

        if (result.success) {
          toast.success(`答案の配置を交換しました`)
          onReloadData?.()
        } else {
          toast.error(`配置交換に失敗しました: ${result.error}`)
        }
      } catch (error) {
        console.error("Error swapping answer sheet placements:", error)
        toast.error("配置交換中にエラーが発生しました")
      }
    },
    [onReloadData],
  )

  // ドラッグ&ドロップセンサー設定
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      const activeId = active.id.toString()

      const activeFileFromEnabled = getEnabledFiles().find(
        (f) => f.id === activeId,
      )
      const activeFileFromDisabled = getDisabledFiles().find(
        (f) => f.id === activeId,
      )

      if (activeFileFromEnabled) {
        setActiveFile(activeFileFromEnabled)
        setIsDraggingFromTrash(false)
      } else if (activeFileFromDisabled) {
        setActiveFile(activeFileFromDisabled)
        setIsDraggingFromTrash(true)
      }
    },
    [getEnabledFiles, getDisabledFiles],
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeId = active.id.toString()
      const overId = over.id.toString()

      // コンテナ判定関数
      const findContainer = (id: string) => {
        if (id === "trash-area" || id === "trash-popover-trigger")
          return "trash"

        const enabledFile = getEnabledFiles().find((file) => file.id === id)
        if (enabledFile) return "main"

        const disabledFile = getDisabledFiles().find((file) => file.id === id)
        if (disabledFile) return "trash"

        return null
      }

      const activeContainer = findContainer(activeId)
      const overContainer = findContainer(overId)

      if (activeContainer !== overContainer) {
        // コンテナ間移動の処理
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
    },
    [getEnabledFiles, getDisabledFiles, setDisabledState],
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over) {
        setActiveFile(null)
        setIsDraggingFromTrash(false)
        return
      }

      const activeId = active.id.toString()
      const overId = over.id.toString()

      if (activeId === overId) {
        setActiveFile(null)
        setIsDraggingFromTrash(false)
        return
      }

      // コンテナ判定関数
      const findContainer = (id: string) => {
        if (id === "trash-area" || id === "trash-popover-trigger")
          return "trash"

        const enabledFile = getEnabledFiles().find((file) => file.id === id)
        if (enabledFile) return "main"

        const disabledFile = getDisabledFiles().find((file) => file.id === id)
        if (disabledFile) return "trash"

        return null
      }

      const activeContainer = findContainer(activeId)
      const overContainer = findContainer(overId)

      if (activeContainer === overContainer && activeId !== overId) {
        // 新規追加・確認モード共通: arrayMoveによる順延ロジック
        const newFiles = [...files]
        const oldIndex = newFiles.findIndex((file) => file.id === activeId)
        const newIndex = newFiles.findIndex((file) => file.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          // 1. fileIdのみを入れ替え、各位置のstudentIdとpageNumberは固定
          const originalFiles = [...newFiles]
          const reorderedFileIds = arrayMove(
            newFiles.map((f) => f.id),
            oldIndex,
            newIndex,
          )

          // 2. 各位置に対して、新しいfileIdと元の論理位置を組み合わせ
          const reorderedFiles = originalFiles.map((originalFile, index) => ({
            ...files.find((f) => f.id === reorderedFileIds[index])!, // 新しいfileIdのファイルオブジェクト
            studentId: originalFile.studentId, // 元の位置のstudentId
            pageNumber: originalFile.pageNumber, // 元の位置のpageNumber
          }))

          onFilesChange(reorderedFiles)

          // 3. DnD操作時: 配列変更 + 3つ組同期更新（ファイル実データをそのまま使用）
          if (mode === "view") {
            const newFileStates = updateFileStatesFromDnDArray(reorderedFiles)
            fileStatesRef.current = newFileStates
          }

          // 確認モードでは一括でPendingChangeを更新
          if (
            mode === "view" &&
            students &&
            masterImageCount &&
            onUpdatePendingChanges &&
            initialFileStatesRef.current.length > 0
          ) {
            // 現在のファイル状態と初期状態を比較
            const currentFileStates = fileStatesRef.current
            const changedFiles = compareFileStates(
              initialFileStatesRef.current,
              currentFileStates,
            )

            // 変更されたファイル情報を一括で親に渡す
            onUpdatePendingChanges(changedFiles)

            // ドラッグ操作完了のtoast表示
            if (changedFiles.length > 0) {
              toast.success(
                `${changedFiles.length}件の答案配置を変更しました`,
                {
                  description: "「変更を反映」ボタンで確定してください",
                },
              )
            } else {
              toast.info("元の位置に戻されました")
            }
          } else if (mode === "upload") {
            // upload モードでのドラッグ操作完了のtoast
            toast.success("答案の配置を変更しました")
          }
        }
      }

      setActiveFile(null)
      setIsDraggingFromTrash(false)
    },
    [
      files,
      onFilesChange,
      getEnabledFiles,
      getDisabledFiles,
      mode,
      students,
      masterImageCount,
      onUpdatePendingChanges,
      updateFileStatesFromDnDArray,
      compareFileStates,
    ],
  )

  // キャンセル時に初期状態に戻すリセット関数
  const resetToInitialState = useCallback(() => {
    if (mode === "view" && initialFileStatesRef.current.length > 0) {
      const resetFiles = buildDnDArrayFromFileStates(
        initialFileStatesRef.current,
        fileOrder || "page-first",
      )
      if (resetFiles.length > 0) {
        onFilesChange(resetFiles)
        fileStatesRef.current = [...initialFileStatesRef.current]
      }
    }
  }, [mode, fileOrder, buildDnDArrayFromFileStates, onFilesChange])

  return {
    sensors,
    activeFile,
    isDraggingFromTrash,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetToInitialState,
  }
}
