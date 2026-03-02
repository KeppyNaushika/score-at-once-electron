"use client"

import { Download, FolderOpen, Redo2, Save, Undo2 } from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RenderMode } from "@/types/answerSheetBuilder.types"

import { ExamIntegrationDialog } from "./components/export/ExamIntegrationDialog"
import { ExportDialog } from "./components/export/ExportDialog"
import { GlobalSettingsForm } from "./components/form/GlobalSettingsForm"
import { LineStylePicker } from "./components/form/LineStylePicker"
import { OMRMarkerSettings } from "./components/form/OMRMarkerSettings"
import { QuestionListEditor } from "./components/form/QuestionListEditor"
import { AnswerSheetPreview } from "./components/preview/AnswerSheetPreview"
import { useAnswerSheetDefinition } from "./hooks/useAnswerSheetDefinition"
import {
  useAnswerSheetLayout,
  useMultiPageLayout,
} from "./hooks/useAnswerSheetLayout"
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
    reorderMajorQuestions,
    reorderSubQuestions,
    reorderBranchQuestions,
    setLabelPreset,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useAnswerSheetDefinition()

  const layout = useAnswerSheetLayout(definition)
  const multiPageLayout = useMultiPageLayout(definition)

  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo })

  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [examDialogOpen, setExamDialogOpen] = useState(false)

  // 問題統計（全ページのセルから集計）
  const allCells = multiPageLayout.pages.flatMap((p) => p.cells)
  const totalQuestions = allCells.filter((c) => c.cellType === "answer").length
  const totalPoints = allCells
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
    <div className="flex h-screen">
      {/* 左パネル: フォーム */}
      <div className="flex w-1/2 max-w-2xl shrink-0 flex-col overflow-hidden border-r">
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
            onClick={() => setExamDialogOpen(true)}
          >
            <FolderOpen className="mr-1 h-3 w-3" />
            変換
          </Button>
        </div>

        {/* タブ付きフォーム本体 */}
        <Tabs defaultValue="questions" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-2 w-auto">
            <TabsTrigger value="questions" className="text-xs">
              問題構成
            </TabsTrigger>
            <TabsTrigger value="paper" className="text-xs">
              用紙設定
            </TabsTrigger>
            <TabsTrigger value="lines" className="text-xs">
              罫線
            </TabsTrigger>
            <TabsTrigger value="omr" className="text-xs">
              OMR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="questions" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3">
                <QuestionListEditor
                  majorQuestions={definition.majorQuestions}
                  labelPresets={definition.labelPresets}
                  onSetLabelPreset={setLabelPreset}
                  onAddMajor={addMajorQuestion}
                  onUpdateMajor={updateMajorQuestion}
                  onDeleteMajor={deleteMajorQuestion}
                  onReorderMajor={reorderMajorQuestions}
                  onAddSub={addSubQuestion}
                  onUpdateSub={updateSubQuestion}
                  onDeleteSub={deleteSubQuestion}
                  onReorderSub={reorderSubQuestions}
                  onAddBranch={addBranchQuestion}
                  onUpdateBranch={updateBranchQuestion}
                  onDeleteBranch={deleteBranchQuestion}
                  onReorderBranch={reorderBranchQuestions}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="paper" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3">
                <GlobalSettingsForm
                  settings={definition.settings}
                  onUpdate={updateSettings}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="lines" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3">
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
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="omr" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3">
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
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* フッター統計 */}
        <div className="text-muted-foreground flex justify-between border-t p-2 text-xs">
          <span>
            {totalQuestions}問
            {multiPageLayout.totalPages > 1 &&
              ` / ${multiPageLayout.totalPages}ページ`}
          </span>
          <span>合計 {totalPoints}点</span>
        </div>
      </div>

      {/* 右パネル: プレビュー */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AnswerSheetPreview
          layout={layout}
          multiPageLayout={multiPageLayout}
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
      <ExamIntegrationDialog
        open={examDialogOpen}
        onOpenChange={setExamDialogOpen}
        definition={definition}
        totalQuestions={totalQuestions}
        totalPoints={totalPoints}
      />
    </div>
  )
}
