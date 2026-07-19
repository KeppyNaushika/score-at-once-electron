"use client"

import { ArrowLeft, Redo2, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { useSaveStatus } from "@/components/hooks/useSaveStatus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import type { RenderMode } from "@/types/answerSheetDefinition.types"

import { countAsbQuestions } from "./answerSheetStats"
import { GlobalSettingsForm } from "./components/form/GlobalSettingsForm"
import { HeaderFieldEditor } from "./components/form/HeaderFieldEditor"
import { LineStylePicker } from "./components/form/LineStylePicker"
import { MultiColumnSettings } from "./components/form/MultiColumnSettings"
import { OMRMarkerSettings } from "./components/form/OMRMarkerSettings"
import { QuestionListEditor } from "./components/form/QuestionListEditor"
import { AnswerSheetPreview } from "./components/preview/AnswerSheetPreview"
import { useAnswerSheetDefinition } from "./hooks/useAnswerSheetDefinition"
import {
  useAnswerSheetLayout,
  useMultiPageLayout,
} from "./hooks/useAnswerSheetLayout"
import { useUndoRedoShortcuts } from "./hooks/useUndoRedoShortcuts"

interface AnswerSheetBuilderMainViewProps {
  definitionId: string
}

/**
 * 解答用紙ビルダーのメインビュー。
 * 設問編集フォーム・SVGプレビュー・エクスポート機能を統合する。
 */
export function AnswerSheetBuilderMainView({
  definitionId,
}: AnswerSheetBuilderMainViewProps) {
  const { user } = useAuth()
  const router = useRouter()
  const {
    definition,
    dispatch,
    setDefinition,
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
    addHeaderField,
    updateHeaderField,
    deleteHeaderField,
    reorderHeaderFields,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useAnswerSheetDefinition()

  const [isLoaded, setIsLoaded] = useState(false)
  const { saveStatus, showSaving, showSaved } = useSaveStatus()

  // DBから定義をロード
  useEffect(() => {
    const load = async () => {
      const api = window.electronAPI?.answerSheetBuilder
      if (!api) return
      const result = await api.loadDefinition(definitionId)
      if (result.success && result.data) {
        setDefinition(result.data)
      } else {
        toast.error(result.error ?? "定義の読み込みに失敗しました")
      }
      setIsLoaded(true)
    }
    load()
  }, [definitionId, setDefinition])

  // 即時自動保存
  useEffect(() => {
    if (!isLoaded) return

    const api = window.electronAPI?.answerSheetBuilder
    if (!api || !user?.id) return

    showSaving()
    api.saveDefinition(definition, user.id).then((result) => {
      if (result.success) {
        showSaved()
      } else {
        toast.error(`保存エラー: ${result.error}`)
      }
    })
  }, [definition, isLoaded, user?.id, showSaving, showSaved])

  const layout = useAnswerSheetLayout(definition)
  const multiPageLayout = useMultiPageLayout(definition)

  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo })

  // 問題統計（設問数はレイアウトの解答セル数、合計配点は定義から集計）
  const allCells = multiPageLayout.pages.flatMap((page) => page.cells)
  const totalQuestions = allCells.filter(
    (cell) => cell.cellType === "answer"
  ).length
  const { totalPoints } = countAsbQuestions(definition.majorQuestions)

  const handleRenderModeChange = useCallback(
    (mode: RenderMode) => {
      dispatch({ type: "SET_RENDER_MODE", payload: mode })
    },
    [dispatch]
  )

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground text-sm">読み込み中...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* 左パネル: フォーム */}
      <div className="flex w-1/2 max-w-2xl shrink-0 flex-col overflow-hidden border-r">
        {/* 名前入力 */}
        <div className="flex items-center gap-2 border-b p-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={() => router.push("/answer-sheet-builder")}
            title="一覧に戻る"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
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
            <TabsTrigger value="header" className="text-xs">
              ヘッダー
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
                  definitionId={definition.id}
                  vertical={definition.settings.verticalLayout ?? false}
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
              <div className="space-y-6 p-3">
                <GlobalSettingsForm
                  settings={definition.settings}
                  onUpdate={updateSettings}
                />
                <Separator />
                <MultiColumnSettings
                  settings={definition.settings}
                  onUpdate={updateSettings}
                  vertical={definition.settings.verticalLayout ?? false}
                />
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="header" className="min-h-0 flex-1">
            <ScrollArea className="h-full">
              <div className="p-3">
                <HeaderFieldEditor
                  fields={definition.settings.headerFields}
                  onAdd={addHeaderField}
                  onUpdate={updateHeaderField}
                  onDelete={deleteHeaderField}
                  onReorder={reorderHeaderFields}
                  vertical={definition.settings.verticalLayout ?? false}
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
          <span>{saveStatus}</span>
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
          borderConfig={definition.settings.borderConfig}
        />
      </div>
    </div>
  )
}
