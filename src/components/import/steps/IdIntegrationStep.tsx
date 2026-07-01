"use client"

import { Layers, Loader2, School, Settings, Users } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

import {
  type CategoryType,
  ClassIntegrationPanel,
  StudentIntegrationPanel,
  SubtotalGroupIntegrationPanel,
} from "./id-integration"

interface IdIntegrationStepProps {
  wizard: UseImportWizardReturn
}

/**
 * ID統合ステップ (Step 3)
 *
 * レコードのIDをどうするか決める。
 * - 紐づけ方法の選択
 * - 同一人物の場合のID選択（このPCに合わせる / 書き出したPCに合わせる）
 */
export function IdIntegrationStep({ wizard }: IdIntegrationStepProps) {
  const { state, goToNextStep, updateIdIntegrationConfig } = wizard
  const [activeTab, setActiveTab] = useState<CategoryType>("student")

  // 判断が必要なデータがあるかチェック
  const hasStudentDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.student.byId.length <
      (state.manifest?.counts.students ?? 0)
  const hasClassDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.classroom.byId.length <
      (state.manifest?.counts.classrooms ?? 0)
  const hasSubtotalGroupDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.subtotalGroup.byId.length <
      (state.manifest?.counts.subtotalGroups ?? 0)

  // 小計グループnoMatchに未決定のアイテムがあるか
  const hasUndecidedSubtotalGroupNoMatch = (() => {
    if (!state.fileOverviewData) return false
    const noMatch = state.fileOverviewData.subtotalGroup.noMatch
    if (noMatch.length === 0) return false
    const strategy = state.idIntegrationConfig.subtotalGroup.strategy
    if (strategy === "all_new") return false // all_newなら決定不要
    const decisions = state.idIntegrationConfig.subtotalGroup.decisions
    const decidedIds = new Set(decisions.map((d) => d.importId))
    return noMatch.some((item) => !decidedIds.has(item.importId))
  })()

  // 何も判断が必要ない場合はスキップ可能
  const canSkip =
    !hasStudentDecisions && !hasClassDecisions && !hasSubtotalGroupDecisions

  if (canSkip) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/20">
          <Settings className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          すべてのデータが自動で紐づきました
        </h3>
        <p className="text-muted-foreground mb-8 max-w-md text-center">
          同じパソコンで作成されたデータのため、
          すべての生徒・学級・小計グループが自動的に紐づけられました。
        </p>
        <Button
          onClick={goToNextStep}
          disabled={state.isProcessing}
          size="lg"
          className="px-8"
        >
          {state.isProcessing && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          次へ
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <Settings className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">データの紐づけ</h3>
        <p className="text-muted-foreground max-w-lg">
          判断が必要なデータについて、どうやって既存のデータと紐づけるか選んでください。
        </p>
      </div>

      {/* タブ形式でカテゴリ別に設定 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as CategoryType)}
        className="flex-1"
      >
        <TabsList className="mb-4 grid w-full grid-cols-3">
          <TabsTrigger value="student" className="gap-2">
            <Users className="h-4 w-4" />
            生徒
            {hasStudentDecisions && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                !
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="classroom" className="gap-2">
            <School className="h-4 w-4" />
            学級
            {hasClassDecisions && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                !
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="subtotalGroup" className="gap-2">
            <Layers className="h-4 w-4" />
            小計グループ
            {hasSubtotalGroupDecisions && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                !
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* 生徒タブ */}
        <TabsContent value="student" className="mt-0">
          <StudentIntegrationPanel
            wizard={wizard}
            onStrategyChange={(strategy) =>
              updateIdIntegrationConfig("student", { strategy, decisions: [] })
            }
          />
        </TabsContent>

        {/* 学級タブ */}
        <TabsContent value="classroom" className="mt-0">
          <ClassIntegrationPanel
            wizard={wizard}
            onStrategyChange={(strategy) =>
              updateIdIntegrationConfig("classroom", {
                strategy,
                decisions: [],
              })
            }
          />
        </TabsContent>

        {/* 小計グループタブ */}
        <TabsContent value="subtotalGroup" className="mt-0">
          <SubtotalGroupIntegrationPanel
            wizard={wizard}
            onStrategyChange={(strategy) =>
              updateIdIntegrationConfig("subtotalGroup", {
                strategy,
                decisions: [],
              })
            }
          />
        </TabsContent>
      </Tabs>

      {/* 次へボタン */}
      <div className="mt-6 flex flex-col items-center gap-2">
        {hasUndecidedSubtotalGroupNoMatch && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            小計グループタブに未決定の項目があります
          </p>
        )}
        <Button
          onClick={goToNextStep}
          disabled={state.isProcessing || hasUndecidedSubtotalGroupNoMatch}
          size="lg"
          className="px-8"
        >
          {state.isProcessing && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          次へ
        </Button>
      </div>
    </div>
  )
}
