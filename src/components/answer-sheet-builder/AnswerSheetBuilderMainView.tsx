"use client"

import { useMutation, useQuery } from "@tanstack/react-query"
import { Redo2, Undo2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"

import { useSaveStatus } from "@/components/hooks/useSaveStatus"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { parsePreference } from "@/lib/userPreferences"
import {
  answerSheetDefinitionQuery,
  applyAnswerSheetEditMutation,
  replaceAnswerSheetDefinitionMutation,
} from "@/queries/answerSheetBuilder"
import {
  setUserPreferenceMutation,
  userPreferenceQuery,
} from "@/queries/settings"
import type {
  AnswerSheetDefinition,
  AnswerSheetEditAction,
  PaperSettings,
} from "@/types/answerSheetDefinition.types"

import { countAsbQuestions } from "./answerSheetStats"
import { AsbGestureProvider } from "./AsbGestureContext"
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
import { useAsbWriteGate } from "./hooks/useAsbWriteGate"
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
  const currentUser = useCurrentUser()
  const router = useRouter()

  // どちらの姿で見るかは、解答用紙ではなく使う人に付く（他の解答用紙を開いても同じ）
  const { data: storedRenderMode } = useQuery(
    userPreferenceQuery(currentUser.id, "asbRenderMode")
  )
  const renderMode = parsePreference("asbRenderMode", storedRenderMode ?? null)
  const { mutate: setPreference } = useMutation(
    setUserPreferenceMutation(currentUser.id)
  )

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
    refetch: refetchDefinition,
  } = useQuery(answerSheetDefinitionQuery(definitionId))

  // 編集1つ＝1レコードの書き込み1本。木をまるごと置き換えるのは undo / redo だけ
  //
  // **`mutateAsync` で待つ。** 呼び出しごとのコールバック（`mutate(action, {onError})`）は
  // 使えない — 観測子が1つなので `MutationObserver.mutate` が前の分を切り離し、**解決前に
  // 次が来ると先の onError / onSuccess が発火しない**。`updateSubQuestion` は隣を降ろす分と
  // 本体の分を同じ tick で2本出し、関所は溜めた分をまとめて出すので、重なるのが普通
  // （docs/branch-review-findings.md #9）。
  const { mutateAsync: applyEdit } = useMutation(
    applyAnswerSheetEditMutation(definitionId)
  )
  const { mutateAsync: replaceDefinition } = useMutation(
    replaceAnswerSheetDefinitionMutation(definitionId)
  )

  // つまみやドラッグの最中は待たせ、離したときに1回だけ書く。
  // 関所は渡した関数を ref で持ち直すので、`write` の同一性は問わない
  const { onEdit, gestureHandlers } = useAsbWriteGate(write)

  const {
    definition,
    actions,
    setDefinition,
    adoptManuscriptPaperId,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useAnswerSheetDefinition({ onEdit, onRestore: restore })

  /**
   * 失敗したら DB を正として画面を合わせる。
   *
   * 書けなかった値を「保存済み」として見せ続けない。巻き戻し先は手元の断面ではなく DB
   * である（同期で他の教員の変更が入っている可能性がある）。
   *
   * **この画面だけが立て直しを要る。** 他の画面はクエリキャッシュがそのまま状態なので、
   * `MutationCache` が失敗時にも取り直せば表示が揃う。ここは undo / redo のために編集中の
   * 木を reducer に複製として持っているので、取り直したあと入れ直す一手が要る。
   */
  async function recoverFromWriteFailure() {
    const refetched = await refetchDefinition()
    if (refetched.data) setDefinition(refetched.data)
  }

  /**
   * 編集1つを書く。
   *
   * **宣言を巻き上げて、状態を持つフックより前で参照できるようにしている。** 立て直しは
   * `setDefinition` を要るので、フックより後でしか中身を書けない。関所も編集フックも
   * 渡された関数を ref で読み直すので、毎レンダー作り直しても取りこぼさない。
   */
  async function write(action: AnswerSheetEditAction) {
    showSaving()
    try {
      // 原稿用紙だけは、main が書いた行の id が画面の指定と違うことがある
      // （セルと1対1なので、既に在る行があれば main はその id を使い続ける）
      const writtenManuscriptPaper = await applyEdit(action)
      if (writtenManuscriptPaper) {
        adoptManuscriptPaperId(
          writtenManuscriptPaper.parent,
          writtenManuscriptPaper.manuscriptPaperId
        )
      }
      showSaved()
    } catch {
      // 知らせは MutationCache が出す。ここでは表示を DB へ揃えるだけ
      await recoverFromWriteFailure()
    }
  }

  /** undo / redo は木をまるごと置き換える（1つの意図に対応しないので別経路） */
  async function restore(restored: AnswerSheetDefinition) {
    showSaving()
    try {
      await replaceDefinition({ definition: restored, userId: currentUser.id })
      showSaved()
    } catch {
      await recoverFromWriteFailure()
    }
  }

  const [seededDefinitionId, setSeededDefinitionId] = useState<string | null>(
    null
  )
  const isLoaded = seededDefinitionId === definitionId
  if (savedDefinition && !isLoaded) {
    setSeededDefinitionId(definitionId)
    setDefinition(savedDefinition)
  }

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
                    settings={definition.settings}
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
            renderMode={renderMode}
            onRenderModeChange={(mode) =>
              setPreference({ key: "asbRenderMode", value: mode })
            }
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
