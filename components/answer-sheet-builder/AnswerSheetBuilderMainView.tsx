"use client"

import { Download, FolderOpen, Redo2, Save, Undo2 } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import type { RenderMode } from "@/types/answerSheetBuilder.types"

import { ExportDialog } from "./components/export/ExportDialog"
import { ProjectIntegrationDialog } from "./components/export/ProjectIntegrationDialog"
import { GlobalSettingsForm } from "./components/form/GlobalSettingsForm"
import { LineStylePicker } from "./components/form/LineStylePicker"
import { OMRMarkerSettings } from "./components/form/OMRMarkerSettings"
import { QuestionListEditor } from "./components/form/QuestionListEditor"
import { AnswerSheetPreview } from "./components/preview/AnswerSheetPreview"
import { useAnswerSheetDefinition } from "./hooks/useAnswerSheetDefinition"
import { useAnswerSheetLayout } from "./hooks/useAnswerSheetLayout"
import { useUndoRedoShortcuts } from "./hooks/useUndoRedoShortcuts"

export function AnswerSheetBuilderMainView() {
  const {
    definition,
    dispatch,
    setName,
    updateSettings,
    addMajorQuestion,
    updateMajorQuestion,
    deleteMajorQuestion,
    addSubQuestion,
    updateSubQuestion,
    deleteSubQuestion,
    addBranchQuestion,
    updateBranchQuestion,
    deleteBranchQuestion,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useAnswerSheetDefinition()

  const layout = useAnswerSheetLayout(definition)

  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo })

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)

  // 問題統計
  const totalQuestions = layout.cells.filter(
    (c) => c.cellType === "answer"
  ).length
  const totalPoints = layout.cells
    .filter((c) => c.cellType === "answer")
    .reduce((sum, c) => sum + c.points, 0)

  const handleRenderModeChange = useCallback(
    (mode: RenderMode) => {
      dispatch({ type: "SET_RENDER_MODE", payload: mode })
    },
    [dispatch]
  )

  const handleSave = useCallback(async () => {
    const api = window.electronAPI?.answerSheetBuilder
    if (!api) {
      toast.error("Electron APIが利用できません")
      return
    }
    const result = await api.saveDefinition(definition)
    if (result.success) {
      toast.success("定義を保存しました")
    } else {
      toast.error(`保存エラー: ${result.error}`)
    }
  }, [definition])

  return (
    <div className="flex h-full">
      {/* 左パネル: フォーム */}
      <div className="flex w-1/2 max-w-2xl flex-shrink-0 flex-col border-r">
        {/* 名前入力 */}
        <div className="border-b p-3">
          <Input
            value={definition.name}
            onChange={(e) => setName(e.target.value)}
            className="text-sm font-medium"
            placeholder="解答用紙名"
          />
        </div>

        {/* アクションバー */}
        <div className="flex gap-1 border-b p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={undo}
            disabled={!canUndo}
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={redo}
            disabled={!canRedo}
            title="やり直し (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </Button>
          <Separator orientation="vertical" className="mx-1 h-5 self-center" />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
          >
            <Save className="mr-1 h-3 w-3" />
            保存
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setExportDialogOpen(true)}
          >
            <Download className="mr-1 h-3 w-3" />
            出力
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setProjectDialogOpen(true)}
          >
            <FolderOpen className="mr-1 h-3 w-3" />
            変換
          </Button>
        </div>

        {/* フォーム本体 */}
        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">
            <GlobalSettingsForm
              settings={definition.settings}
              onUpdate={updateSettings}
            />

            <Separator />

            <LineStylePicker
              borderConfig={definition.settings.borderConfig}
              onUpdate={(borderConfig) =>
                updateSettings({
                  borderConfig: {
                    ...definition.settings.borderConfig,
                    ...borderConfig,
                  },
                })
              }
            />

            <Separator />

            <OMRMarkerSettings
              config={definition.settings.omrMarkers}
              onUpdate={(omrMarkers) =>
                updateSettings({
                  omrMarkers: {
                    ...definition.settings.omrMarkers,
                    ...omrMarkers,
                  },
                })
              }
            />

            <Separator />

            <QuestionListEditor
              majorQuestions={definition.majorQuestions}
              onAddMajor={addMajorQuestion}
              onUpdateMajor={updateMajorQuestion}
              onDeleteMajor={deleteMajorQuestion}
              onAddSub={addSubQuestion}
              onUpdateSub={updateSubQuestion}
              onDeleteSub={deleteSubQuestion}
              onAddBranch={addBranchQuestion}
              onUpdateBranch={updateBranchQuestion}
              onDeleteBranch={deleteBranchQuestion}
            />
          </div>
        </ScrollArea>

        {/* フッター統計 */}
        <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
          <span>{totalQuestions}問</span>
          <span>合計 {totalPoints}点</span>
        </div>
      </div>

      {/* 右パネル: プレビュー */}
      <div className="flex min-w-0 flex-1 flex-col">
        <AnswerSheetPreview
          layout={layout}
          renderMode={definition.renderMode}
          onRenderModeChange={handleRenderModeChange}
          dispatch={dispatch}
          baseRowHeight={definition.settings.baseRowHeight}
        />
      </div>

      {/* ダイアログ */}
      <ExportDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        definition={definition}
      />
      <ProjectIntegrationDialog
        open={projectDialogOpen}
        onOpenChange={setProjectDialogOpen}
        definition={definition}
        totalQuestions={totalQuestions}
        totalPoints={totalPoints}
      />
    </div>
  )
}
