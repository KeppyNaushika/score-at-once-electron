"use client"

import { Layers, Loader2, School, Settings, UserCog, Users } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"

import { ClassroomIntegrationPanel } from "./id-integration/ClassroomIntegrationPanel"
import { StudentIntegrationPanel } from "./id-integration/StudentIntegrationPanel"
import { SubtotalGroupIntegrationPanel } from "./id-integration/SubtotalGroupIntegrationPanel"
import type { CategoryType } from "./id-integration/types"
import { UserIntegrationPanel } from "./id-integration/UserIntegrationPanel"

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
  const hasClassroomDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.classroom.byId.length <
      (state.manifest?.counts.classrooms ?? 0)
  const hasSubtotalGroupDecisions =
    state.fileOverviewData &&
    state.fileOverviewData.subtotalGroup.byId.length <
      (state.manifest?.counts.subtotalGroups ?? 0)
  // 採点者は manifest の件数と比べない。users.json には採点していない書き出し本人も
  // 載るので、件数の差は「判断が要る採点者がいる」ことを意味しない。照合で
  // 落ちたもの（利用者名一致・一致なし）を直接数える
  const hasUserDecisions =
    state.fileOverviewData?.user !== undefined &&
    (state.fileOverviewData.user.byName?.length ?? 0) +
      state.fileOverviewData.user.noMatch.length >
      0

  // 小計グループnoMatchに未決定のアイテムがあるか
  const hasUndecidedSubtotalGroupNoMatch = (() => {
    if (!state.fileOverviewData) return false
    const noMatch = state.fileOverviewData.subtotalGroup.noMatch
    if (noMatch.length === 0) return false
    const strategy = state.idIntegrationConfig.subtotalGroup.strategy
    if (strategy === "all_new") return false // all_newなら決定不要
    const decisions = state.idIntegrationConfig.subtotalGroup.decisions
    const decidedIds = new Set(decisions.map((decision) => decision.importId))
    return noMatch.some((item) => !decidedIds.has(item.importId))
  })()

  // 何も判断が必要ない場合はスキップ可能
  const canSkip =
    !hasStudentDecisions &&
    !hasClassroomDecisions &&
    !hasSubtotalGroupDecisions &&
    !hasUserDecisions

  if (canSkip) {
    return (
      <div className="flex h-full flex-col items-center justify-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/20">
          <Settings className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">
          すべてのデータが自動で紐づきました
        </h3>
        <p className="mb-8 max-w-md text-center text-muted-foreground">
          同じパソコンで作成されたデータのため、
          すべての生徒・学級・小計グループ・採点者が自動的に紐づけられました。
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
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <Settings className="h-10 w-10 text-primary" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">データの紐づけ</h3>
        <p className="max-w-lg text-muted-foreground">
          判断が必要なデータについて、どうやって既存のデータと紐づけるか選んでください。
        </p>
      </div>

      {/* タブ形式でカテゴリ別に設定 */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as CategoryType)}
        className="flex-1"
      >
        <TabsList className="mb-4 grid w-full grid-cols-4">
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
            {hasClassroomDecisions && (
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
          <TabsTrigger value="user" className="gap-2">
            <UserCog className="h-4 w-4" />
            採点者
            {hasUserDecisions && (
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
          <ClassroomIntegrationPanel
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

        {/* 採点者タブ */}
        <TabsContent value="user" className="mt-0">
          <UserIntegrationPanel wizard={wizard} />
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
