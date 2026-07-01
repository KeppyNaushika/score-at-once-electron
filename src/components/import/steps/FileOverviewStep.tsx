"use client"

import {
  CheckCircle,
  ChevronDown,
  FileText,
  HelpCircle,
  Layers,
  Loader2,
  School,
  User,
  Users,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type { PreMatchingResult } from "@/types/examArchive.types"

interface FileOverviewStepProps {
  wizard: UseImportWizardReturn
}

/**
 * ファイル概要説明ステップ (Step 2)
 *
 * .scoreファイルの中身を説明し、ID一致数と判断必要数を表示する。
 * 紐づけ方法の選択は行わない（それはStep 3で行う）。
 */
export function FileOverviewStep({ wizard }: FileOverviewStepProps) {
  const { state, goToNextStep, performPreMatching } = wizard
  const [isLoading, setIsLoading] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set()
  )

  const handleNext = async () => {
    if (!state.fileOverviewData) {
      setIsLoading(true)
      await performPreMatching()
      setIsLoading(false)
    }
    goToNextStep()
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  // カテゴリ別の統計を計算
  const getStats = (result: PreMatchingResult) => {
    const autoMatched = result.byId.length
    const needsDecision =
      (result.byStudentNumber?.length ?? 0) +
      (result.byName?.length ?? 0) +
      result.noMatch.length
    return { autoMatched, needsDecision }
  }

  const studentStats = state.fileOverviewData
    ? getStats(state.fileOverviewData.student)
    : null
  const classStats = state.fileOverviewData
    ? getStats(state.fileOverviewData.classroom)
    : null
  const subtotalGroupStats = state.fileOverviewData
    ? getStats(state.fileOverviewData.subtotalGroup)
    : null

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <FileText className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">ファイルの内容</h3>
        {state.manifest && (
          <p className="text-muted-foreground">
            「{state.manifest.examName}」の内容を確認します
          </p>
        )}
      </div>

      {/* 説明カード */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
        <CardContent className="p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>同じパソコンで作ったデータは自動で紐づきます。</strong>
            <br />
            別のパソコンからのデータは、次の画面で紐づけ方を選んでいただきます。
          </p>
        </CardContent>
      </Card>

      {/* メイン: ファイル概要 */}
      <div className="flex-1 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-muted-foreground mt-4">照合中...</p>
          </div>
        ) : state.fileOverviewData ? (
          <>
            {/* 生徒 */}
            <CategoryOverviewCard
              icon={<Users className="h-5 w-5" />}
              label="生徒"
              total={state.manifest?.counts.students ?? 0}
              autoMatched={studentStats?.autoMatched ?? 0}
              needsDecision={studentStats?.needsDecision ?? 0}
              isExpanded={expandedCategories.has("student")}
              onToggle={() => toggleCategory("student")}
              autoMatchedItems={state.fileOverviewData.student.byId}
            />

            {/* 学級 */}
            <CategoryOverviewCard
              icon={<School className="h-5 w-5" />}
              label="学級"
              total={state.manifest?.counts.classrooms ?? 0}
              autoMatched={classStats?.autoMatched ?? 0}
              needsDecision={classStats?.needsDecision ?? 0}
              isExpanded={expandedCategories.has("classroom")}
              onToggle={() => toggleCategory("classroom")}
              autoMatchedItems={state.fileOverviewData.classroom.byId}
            />

            {/* 小計グループ */}
            <CategoryOverviewCard
              icon={<Layers className="h-5 w-5" />}
              label="小計グループ"
              total={state.manifest?.counts.subtotalGroups ?? 0}
              autoMatched={subtotalGroupStats?.autoMatched ?? 0}
              needsDecision={subtotalGroupStats?.needsDecision ?? 0}
              isExpanded={expandedCategories.has("subtotalGroup")}
              onToggle={() => toggleCategory("subtotalGroup")}
              autoMatchedItems={state.fileOverviewData.subtotalGroup.byId}
            />
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <HelpCircle className="text-muted-foreground mb-4 h-8 w-8" />
              <p className="text-muted-foreground">
                「次へ」を押して照合を開始してください
              </p>
            </CardContent>
          </Card>
        )}

        {/* 採点者の説明 */}
        <Card className="bg-muted/30">
          <CardContent className="flex items-center gap-3 p-4">
            <User className="text-muted-foreground h-5 w-5" />
            <p className="text-muted-foreground text-sm">
              採点者はログイン中のユーザー（あなた）に紐づきます
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button
          onClick={handleNext}
          disabled={isLoading}
          size="lg"
          className="gap-2 px-8"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              照合中...
            </>
          ) : (
            "次へ"
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * カテゴリ別概要カード
 */
interface CategoryOverviewCardProps {
  icon: React.ReactNode
  label: string
  total: number
  autoMatched: number
  needsDecision: number
  isExpanded: boolean
  onToggle: () => void
  autoMatchedItems: Array<{ displayLabel: string }>
}

function CategoryOverviewCard({
  icon,
  label,
  total,
  autoMatched,
  needsDecision,
  isExpanded,
  onToggle,
  autoMatchedItems,
}: CategoryOverviewCardProps) {
  const unit =
    label === "生徒" ? "名" : label === "学級" ? "クラス" : "グループ"

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{icon}</div>
          <div className="flex-1">
            <p className="font-medium">
              {label}: {total}
              {unit}
            </p>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              {autoMatched > 0 && (
                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  自動で紐づく: {autoMatched}
                  {unit}
                </span>
              )}
              {needsDecision > 0 && (
                <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                  <HelpCircle className="h-4 w-4" />
                  判断が必要: {needsDecision}
                  {unit}
                </span>
              )}
              {autoMatched === 0 && needsDecision === 0 && total === 0 && (
                <span className="text-muted-foreground">データなし</span>
              )}
            </div>
          </div>
          {autoMatched > 0 && (
            <Collapsible open={isExpanded} onOpenChange={onToggle}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  <span className="text-xs">詳細</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          )}
        </div>

        {/* 展開時の詳細 */}
        {autoMatched > 0 && isExpanded && (
          <div className="mt-3 border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs">
              自動で紐づく{label}:
            </p>
            <div className="flex flex-wrap gap-2">
              {autoMatchedItems.slice(0, 10).map((item, index) => (
                <span
                  key={index}
                  className="bg-muted rounded px-2 py-1 text-xs"
                >
                  {item.displayLabel}
                </span>
              ))}
              {autoMatchedItems.length > 10 && (
                <span className="text-muted-foreground text-xs">
                  ...他 {autoMatchedItems.length - 10}
                  {unit}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
