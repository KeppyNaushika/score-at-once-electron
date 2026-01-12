"use client"

import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Link2,
  UserPlus,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryMatchingSummary,
  MatchingCandidate,
  MatchingDecisionType,
} from "@/types/projectArchive.types"

interface DataMatchingStepProps {
  wizard: UseImportWizardReturn
}

/**
 * 生徒・学級の確認ステップ
 *
 * 「この生徒は同じ人ですか？」という直感的な質問で
 * インポートデータと既存データの紐づけを確認
 */
export function DataMatchingStep({ wizard }: DataMatchingStepProps) {
  const { state, setMatchingDecision, setAllMatchingDecisions } = wizard
  const { matchingSummaries, matchingDecisions } = state

  // 生徒のサマリーを取得
  const studentSummary = matchingSummaries.find((s) => s.category === "Student")
  const classSummary = matchingSummaries.find((s) => s.category === "Class")

  // 確認が必要なアイテムがあるか
  const hasConfirmationItems =
    (studentSummary?.needsConfirmation ?? 0) > 0 ||
    (classSummary?.needsConfirmation ?? 0) > 0

  if (!hasConfirmationItems) {
    // 確認不要の場合はサマリーのみ表示
    return (
      <div className="flex h-full flex-col items-center justify-center py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">
            確認が必要な生徒・学級はありません
          </h3>
          <p className="text-muted-foreground max-w-md">
            インポートするデータは自動的に処理されます。
          </p>
        </div>

        <Card className="mb-6 w-full max-w-md">
          <CardContent className="p-5">
            <MatchingSummaryDisplay
              studentSummary={studentSummary}
              classSummary={classSummary}
            />
          </CardContent>
        </Card>

        <Button onClick={wizard.goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-semibold">生徒・学級の確認</h3>
        <p className="text-muted-foreground">
          インポートする生徒と既存の生徒を照合しました。
          <br />
          確認が必要な生徒がいます。
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-4">
          {/* 自動処理サマリー */}
          <AutoProcessedSection
            studentSummary={studentSummary}
            classSummary={classSummary}
          />

          {/* 確認が必要な生徒 */}
          {studentSummary && studentSummary.confirmationItems.length > 0 && (
            <ConfirmationSection
              title="確認が必要な生徒"
              items={studentSummary.confirmationItems}
              decisions={matchingDecisions}
              onDecisionChange={setMatchingDecision}
              onSelectAll={(decision) =>
                setAllMatchingDecisions(
                  studentSummary.confirmationItems.map((item) => item.id),
                  decision
                )
              }
            />
          )}

          {/* 確認が必要な学級 */}
          {classSummary && classSummary.confirmationItems.length > 0 && (
            <ConfirmationSection
              title="確認が必要な学級"
              items={classSummary.confirmationItems}
              decisions={matchingDecisions}
              onDecisionChange={setMatchingDecision}
              onSelectAll={(decision) =>
                setAllMatchingDecisions(
                  classSummary.confirmationItems.map((item) => item.id),
                  decision
                )
              }
            />
          )}

          {/* 問題があるアイテム */}
          {studentSummary && studentSummary.conflictItems.length > 0 && (
            <ConflictSection
              title="学籍番号が重複"
              items={studentSummary.conflictItems}
              decisions={matchingDecisions}
              onDecisionChange={setMatchingDecision}
            />
          )}
        </div>
      </ScrollArea>

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button onClick={wizard.goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// サブコンポーネント
// =============================================================================

interface MatchingSummaryDisplayProps {
  studentSummary?: CategoryMatchingSummary
  classSummary?: CategoryMatchingSummary
}

function MatchingSummaryDisplay({
  studentSummary,
  classSummary,
}: MatchingSummaryDisplayProps) {
  return (
    <div className="space-y-4">
      {studentSummary && (
        <div>
          <h4 className="mb-2 text-sm font-medium">生徒</h4>
          <div className="text-muted-foreground space-y-1 text-sm">
            {studentSummary.autoMatched > 0 && (
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-green-500" />
                既存データと紐づく: {studentSummary.autoMatched}名
              </div>
            )}
            {studentSummary.newItems > 0 && (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                新しく登録: {studentSummary.newItems}名
              </div>
            )}
          </div>
        </div>
      )}
      {classSummary && (
        <div>
          <h4 className="mb-2 text-sm font-medium">学級</h4>
          <div className="text-muted-foreground space-y-1 text-sm">
            {classSummary.autoMatched > 0 && (
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-green-500" />
                既存データと紐づく: {classSummary.autoMatched}クラス
              </div>
            )}
            {classSummary.newItems > 0 && (
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-500" />
                新しく登録: {classSummary.newItems}クラス
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface AutoProcessedSectionProps {
  studentSummary?: CategoryMatchingSummary
  classSummary?: CategoryMatchingSummary
}

function AutoProcessedSection({
  studentSummary,
  classSummary,
}: AutoProcessedSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasAutoProcessed =
    (studentSummary?.autoMatched ?? 0) > 0 ||
    (studentSummary?.newItems ?? 0) > 0 ||
    (classSummary?.autoMatched ?? 0) > 0 ||
    (classSummary?.newItems ?? 0) > 0

  if (!hasAutoProcessed) return null

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <CardTitle className="text-base">
                  自動で処理できる生徒・学級
                </CardTitle>
              </div>
              <ChevronDown
                className={`text-muted-foreground h-5 w-5 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            <MatchingSummaryDisplay
              studentSummary={studentSummary}
              classSummary={classSummary}
            />

            {/* 詳細リスト */}
            {studentSummary && studentSummary.autoMatchedItems.length > 0 && (
              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-xs">
                  既存データと紐づく生徒:
                </p>
                <p className="text-muted-foreground text-sm">
                  {studentSummary.autoMatchedItems
                    .map((item) => item.displayLabel)
                    .join("、")}
                </p>
              </div>
            )}

            {studentSummary && studentSummary.newItemsList.length > 0 && (
              <div className="mt-4">
                <p className="text-muted-foreground mb-2 text-xs">
                  新しく登録する生徒:
                </p>
                <p className="text-muted-foreground text-sm">
                  {studentSummary.newItemsList
                    .map((item) => item.displayLabel)
                    .join("、")}
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface ConfirmationSectionProps {
  title: string
  items: MatchingCandidate[]
  decisions: Record<string, MatchingDecisionType>
  onDecisionChange: (itemId: string, decision: MatchingDecisionType) => void
  onSelectAll: (decision: MatchingDecisionType) => void
}

function ConfirmationSection({
  title,
  items,
  decisions,
  onDecisionChange,
  onSelectAll,
}: ConfirmationSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">
              {title}（{items.length}件）
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectAll("same_person")}
            >
              全て「同じ人」
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectAll("different_person")}
            >
              全て「別の人」
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <ConfirmationCard
            key={item.id}
            item={item}
            decision={decisions[item.id]}
            onDecisionChange={(decision) => onDecisionChange(item.id, decision)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface ConfirmationCardProps {
  item: MatchingCandidate
  decision?: MatchingDecisionType
  onDecisionChange: (decision: MatchingDecisionType) => void
}

function ConfirmationCard({
  item,
  decision,
  onDecisionChange,
}: ConfirmationCardProps) {
  const importData = item.importData as Record<string, unknown>
  const existingData = item.existingData as Record<string, unknown>

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
      <CardContent className="p-4">
        <div className="mb-3 font-medium">{item.displayLabel}</div>

        {/* データ比較 */}
        <div className="bg-background mb-4 rounded-md border p-3 text-sm">
          <div className="mb-2">
            <span className="text-muted-foreground">インポートデータ: </span>
            <span>
              {String(importData.studentNumber || importData.name)} /{" "}
              {String(importData.lastName || "")}
              {String(importData.firstName || "")} /{" "}
              {String(importData.lastNameKana || "")}
              {String(importData.firstNameKana || "")}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">既存の生徒: </span>
            <span>
              {String(existingData.studentNumber || existingData.name)} /{" "}
              {String(existingData.lastName || "")}
              {String(existingData.firstName || "")} /{" "}
              {String(existingData.lastNameKana || "")}
              {String(existingData.firstNameKana || "")}
            </span>
          </div>
        </div>

        {/* マッチング理由 */}
        <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400">
          <span className="text-lg">💡</span>
          {item.matchReason}
        </div>

        {/* 質問と選択肢 */}
        <div className="mb-2 font-medium">この生徒は同じ人ですか？</div>
        <RadioGroup
          value={decision || "same_person"}
          onValueChange={(value) =>
            onDecisionChange(value as MatchingDecisionType)
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="same_person" id={`${item.id}-same`} />
            <Label htmlFor={`${item.id}-same`} className="cursor-pointer">
              はい、同じ人です（既存データと紐づける）
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="different_person" id={`${item.id}-diff`} />
            <Label htmlFor={`${item.id}-diff`} className="cursor-pointer">
              いいえ、別の人です（新しく登録する）
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

interface ConflictSectionProps {
  title: string
  items: MatchingCandidate[]
  decisions: Record<string, MatchingDecisionType>
  onDecisionChange: (itemId: string, decision: MatchingDecisionType) => void
}

function ConflictSection({
  title,
  items,
  decisions,
  onDecisionChange,
}: ConflictSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <CardTitle className="text-base">
            {title}（{items.length}件）
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <ConflictCard
            key={item.id}
            item={item}
            decision={decisions[item.id]}
            onDecisionChange={(decision) => onDecisionChange(item.id, decision)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface ConflictCardProps {
  item: MatchingCandidate
  decision?: MatchingDecisionType
  onDecisionChange: (decision: MatchingDecisionType) => void
}

function ConflictCard({ item, decision, onDecisionChange }: ConflictCardProps) {
  const importData = item.importData as Record<string, unknown>

  return (
    <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
      <CardContent className="p-4">
        <div className="mb-3 font-medium">{item.displayLabel}</div>

        {/* 警告メッセージ */}
        <div className="mb-4 flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            学籍番号「{String(importData.studentNumber)}
            」は既に別の生徒が使用中です
          </span>
        </div>

        {/* 選択肢 */}
        <div className="mb-2 font-medium">どうしますか？</div>
        <RadioGroup
          value={decision || "different_person"}
          onValueChange={(value) =>
            onDecisionChange(value as MatchingDecisionType)
          }
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="different_person" id={`${item.id}-rename`} />
            <Label htmlFor={`${item.id}-rename`} className="cursor-pointer">
              「{String(importData.studentNumber)}_2」として登録する
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="skip" id={`${item.id}-skip`} />
            <Label htmlFor={`${item.id}-skip`} className="cursor-pointer">
              この生徒はインポートしない
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}
