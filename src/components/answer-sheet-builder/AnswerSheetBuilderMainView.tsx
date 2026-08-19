"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { ArrowLeft, Redo2, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

import { useSaveStatus } from "@/components/hooks/useSaveStatus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/AuthContext"
import {
  answerSheetDefinitionQuery,
  saveAnswerSheetDefinitionMutation,
} from "@/queries/answerSheetBuilder"
import type {
  AnswerSheetDefinition,
  PaperSettings,
} from "@/types/answerSheetDefinition.types"

import { countAsbQuestions } from "./answerSheetStats"
import { AsbGestureProvider, useAsbGestureOwner } from "./AsbGestureContext"
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
import { useAsbOwner } from "./hooks/useAsbOwner"
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
    actions,
    setDefinition,
    setRenderMode,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useAnswerSheetDefinition()
  // つまみやドラッグの最中は保存しない（離したときに1回だけ書く）
  const { isGesturing, handlers: gestureHandlers } = useAsbGestureOwner()

  const { saveStatus, showSaving, showSaved } = useSaveStatus()
  const {
    isOwner,
    ownerName,
    isPending: isOwnerPending,
  } = useAsbOwner(definitionId)

  // 保存済みの内容。編集はこの後 setDefinition が持つので、読み込んだ形を1度だけ渡す
  const {
    data: savedDefinition,
    isPending: isLoadPending,
    error: loadError,
  } = useQuery(answerSheetDefinitionQuery(definitionId))
  const { mutateAsync: saveDefinition } = useMutation(
    saveAnswerSheetDefinitionMutation(definitionId)
  )

  /**
   * 直近で DB に入っていると分かっている内容。
   *
   * これと同じものを保存しに行かないための目印。読み込んだ直後に自動保存が
   * 発火すると、開いただけで書き込みが走る。取得が古ければ、それを書き戻して
   * 編集を巻き戻すことにもなる。
   */
  const [persisted, setPersisted] = useState<AnswerSheetDefinition | null>(null)
  const [seededDefinitionId, setSeededDefinitionId] = useState<string | null>(
    null
  )
  const isLoaded = seededDefinitionId === definitionId
  if (savedDefinition && !isLoaded) {
    setSeededDefinitionId(definitionId)
    setDefinition(savedDefinition)
    setPersisted(savedDefinition)
  }

  // 即時自動保存（担当者だけ。読み込んだ内容そのものは書き戻さない）
  useEffect(() => {
    if (!isLoaded || !isOwner || !user?.id) return
    if (definition === persisted) return
    if (isGesturing) return

    showSaving()
    const saving = definition
    saveDefinition({ definition: saving, userId: user.id })
      .then(() => {
        setPersisted(saving)
        showSaved()
      })
      .catch(() => {
        // 失敗の通知は MutationCache が出す。ここは「保存済み」の目印を進めない
      })
  }, [
    definition,
    persisted,
    isLoaded,
    isOwner,
    isGesturing,
    user?.id,
    showSaving,
    showSaved,
    saveDefinition,
  ])

  /** 用紙設定の一部だけを差し替える（解答用紙1件の列を書く、と同じこと） */
  const updatePaperSettings = useCallback(
    (settings: Partial<PaperSettings>) =>
      actions.updateDefinition({ settings }),
    [actions]
  )

  const layout = useAnswerSheetLayout(definition)
  const multiPageLayout = useMultiPageLayout(definition)

  useUndoRedoShortcuts({ undo, redo, canUndo, canRedo })

  // 問題統計（設問数はレイアウトの解答セル数、合計配点は解答用紙から集計）
  const allCells = multiPageLayout.pages.flatMap((page) => page.cells)
  const totalQuestions = allCells.filter(
    (cell) => cell.cellType === "answer"
  ).length
  const { totalPoints } = countAsbQuestions(definition.majorQuestions)

  // 以下の関門はそれぞれ独立に見る。入れ子にすると、外側が先に外れた時点で
  // 内側へ到達しなくなる（担当の判定を `!isLoaded` の中に置いていて、担当で
  // ない利用者にも編集画面が出ていた）。
  //
  // 読み込みに失敗したまま編集画面を出すと、書いた内容の行き先が無い
  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium text-red-600">
          解答用紙を読み込めませんでした
        </p>
        <p className="text-sm text-muted-foreground">{loadError.message}</p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  if (isLoadPending || isOwnerPending || !isLoaded) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      </div>
    )
  }

  // 編集できるのは担当者だけ。他の人は概要と書き出しから見る
  if (!isOwner) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm font-medium">この解答用紙の担当ではありません</p>
        <p className="text-sm text-muted-foreground">
          編集できるのは担当の{ownerName ?? "利用者"}さんだけです。
          直したいときは担当を渡してもらってください。
        </p>
        <Button variant="outline" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    )
  }

  return (
    <AsbGestureProvider handlers={gestureHandlers}>
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
              onChange={(e) =>
                actions.updateDefinition({ name: e.target.value })
              }
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
          <Tabs
            defaultValue="questions"
            className="flex min-h-0 flex-1 flex-col"
          >
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
                    actions={actions}
                    vertical={definition.settings.verticalLayout ?? false}
                  />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="paper" className="min-h-0 flex-1">
              <ScrollArea className="h-full">
                <div className="space-y-6 p-3">
                  <GlobalSettingsForm
                    settings={definition.settings}
                    onUpdate={updatePaperSettings}
                  />
                  <Separator />
                  <MultiColumnSettings
                    settings={definition.settings}
                    onUpdate={updatePaperSettings}
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
                    onAdd={actions.addHeaderField}
                    onUpdate={actions.updateHeaderField}
                    onDelete={actions.deleteHeaderField}
                    onReorder={actions.reorderHeaderFields}
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
                      updatePaperSettings({
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
                      updatePaperSettings({
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
          <div className="flex justify-between border-t p-2 text-xs text-muted-foreground">
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
            onRenderModeChange={setRenderMode}
            onResizeSubQuestion={(subQuestionId, heightMultiplier) =>
              actions.updateSubQuestion(subQuestionId, { heightMultiplier })
            }
            onResizeBranchQuestion={(branchQuestionId, heightMultiplier) =>
              actions.updateBranchQuestion(branchQuestionId, {
                heightMultiplier,
              })
            }
            onResizeColumn={(column, widthMm) =>
              updatePaperSettings({
                columnWidths: {
                  ...definition.settings.columnWidths,
                  [column]: widthMm,
                },
              })
            }
            baseRowHeight={definition.settings.baseRowHeight}
            borderConfig={definition.settings.borderConfig}
          />
        </div>
      </div>
    </AsbGestureProvider>
  )
}
