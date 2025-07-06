import type { ExtendedDisabledState } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
import type { UnifiedFile, UnifiedStudent } from "@/types/answer-sheet.types"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useState } from "react"
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
  onReloadData?: () => void,
) {
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)
  const [isDraggingFromTrash, setIsDraggingFromTrash] = useState(false)

  // テーブル位置から生徒IDとページ番号を計算する関数
  const getStudentAndPageFromPosition = useCallback((position: number) => {
    if (!students || !masterImageCount) return { student: null, pageNumber: 1 }
    
    const studentIndex = Math.floor(position / masterImageCount)
    const pageIndex = position % masterImageCount
    
    const student = students[studentIndex] || null
    const pageNumber = pageIndex + 1
    
    return { student, pageNumber }
  }, [students, masterImageCount])

  // 確認モードでの答案配置更新
  const updateAnswerSheetInDatabase = useCallback(async (file: UnifiedFile, targetPosition: number) => {
    const { student, pageNumber } = getStudentAndPageFromPosition(targetPosition)
    
    try {
      const result = await window.electronAPI.updateAnswerSheetPlacement(
        file.id,
        student?.id || null,
        pageNumber
      )
      
      if (result.success) {
        toast.success(`答案の配置を更新しました`)
        onReloadData?.()
      } else {
        toast.error(`配置更新に失敗しました: ${result.error}`)
      }
    } catch (error) {
      console.error('Error updating answer sheet placement:', error)
      toast.error('配置更新中にエラーが発生しました')
    }
  }, [getStudentAndPageFromPosition, onReloadData])

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
        if (mode === "view" && students && masterImageCount) {
          // 確認モード: テーブル位置ベースでの配置交換
          const activeFile = getEnabledFiles().find(f => f.id === activeId)
          const overFile = getEnabledFiles().find(f => f.id === overId)
          
          if (activeFile && overFile) {
            // 2つのファイルの配置を交換
            const { student: activeStudent, pageNumber: activePageNumber } = 
              getStudentAndPageFromPosition(activeFile.position || 0)
            const { student: overStudent, pageNumber: overPageNumber } = 
              getStudentAndPageFromPosition(overFile.position || 0)
            
            // データベースで交換
            Promise.all([
              updateAnswerSheetInDatabase(activeFile, overFile.position || 0),
              updateAnswerSheetInDatabase(overFile, activeFile.position || 0)
            ])
          }
        } else {
          // アップロードモード: 従来の配列並び替え
          const newFiles = [...files]
          const oldIndex = newFiles.findIndex((file) => file.id === activeId)
          const newIndex = newFiles.findIndex((file) => file.id === overId)

          if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedFiles = arrayMove(newFiles, oldIndex, newIndex)
            onFilesChange(reorderedFiles)
          }
        }
      }

      setActiveFile(null)
      setIsDraggingFromTrash(false)
    },
    [files, onFilesChange, getEnabledFiles, getDisabledFiles, mode, students, masterImageCount, getStudentAndPageFromPosition, updateAnswerSheetInDatabase],
  )

  return {
    sensors,
    activeFile,
    isDraggingFromTrash,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  }
}
