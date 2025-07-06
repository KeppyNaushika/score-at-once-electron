import type { ExtendedDisabledState } from "@/components/projects/05-answer-sheets/answer-sheet-table/types"
import type { UnifiedFile } from "@/types/answer-sheet.types"
import type { DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/core"
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { arrayMove } from "@dnd-kit/sortable"
import { useCallback, useState } from "react"

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
) {
  const [activeFile, setActiveFile] = useState<UnifiedFile | null>(null)
  const [isDraggingFromTrash, setIsDraggingFromTrash] = useState(false)

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
        // 同一コンテナ内での並び替え
        const newFiles = [...files]
        const oldIndex = newFiles.findIndex((file) => file.id === activeId)
        const newIndex = newFiles.findIndex((file) => file.id === overId)

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedFiles = arrayMove(newFiles, oldIndex, newIndex)
          onFilesChange(reorderedFiles)
        }
      }

      setActiveFile(null)
      setIsDraggingFromTrash(false)
    },
    [files, onFilesChange, getEnabledFiles, getDisabledFiles],
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
