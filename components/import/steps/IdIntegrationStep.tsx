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
  const { state, detectScoringConflicts, updateIdIntegrationConfig } = wizard
  const [activeTab, setActiveTab] = useState<CategoryType>("student")
  const [isProcessing, setIsProcessing] = useState(false)

  // 判断が必要なデータがあるかチェック
  const hasStudentDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.student.byId.length <
      (state.manifest?.counts.students ?? 0)
  const hasClassDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.class.byId.length <
      (state.manifest?.counts.classes ?? 0)
  const hasSubtotalGroupDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.subtotalGroup.byId.length <
      (state.manifest?.counts.subtotalGroups ?? 0)

  // 何も判断が必要ない場合はスキップ可能
  const canSkip =
    !hasStudentDecisions && !hasClassDecisions && !hasSubtotalGroupDecisions

  const handleNext = async () => {
    setIsProcessing(true)
    // 採点競合検出を実行してscoring_conflictステップへ進む
    await detectScoringConflicts()
    setIsProcessing(false)
  }

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
        <Button onClick={handleNext} size="lg" className="px-8">
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
          <TabsTrigger value="class" className="gap-2">
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
        <TabsContent value="class" className="mt-0">
          <ClassIntegrationPanel
            wizard={wizard}
            onStrategyChange={(strategy) =>
              updateIdIntegrationConfig("class", { strategy, decisions: [] })
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
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleNext}
          disabled={isProcessing}
          size="lg"
          className="gap-2 px-8"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              処理中...
            </>
          ) : (
            "次へ"
          )}
        </Button>
      </div>
    </div>
  )
}
