"use client"

import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  GraduationCap,
  Layers,
  RefreshCw,
  Users,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryIdIntegrationConfig,
  MatchedItem,
  PreMatchingResult,
} from "@/types/projectArchive.types"

interface UpdateConfirmStepProps {
  wizard: UseImportWizardReturn
}

/** フィールド変更情報 */
interface FieldChange {
  field: string
  fieldLabel: string
  currentValue: unknown
  newValue: unknown
}

/** 更新が必要なアイテム */
interface UpdateableItem {
  id: string
  category: "student" | "class" | "subtotalGroup"
  displayLabel: string
  fieldChanges: FieldChange[]
  importData: Record<string, unknown>
  existingData: Record<string, unknown>
}

/**
 * フィールドラベルの定義
 */
const FIELD_LABELS: Record<string, Record<string, string>> = {
  student: {
    lastName: "姓",
    firstName: "名",
    lastNameKana: "姓（カナ）",
    firstNameKana: "名（カナ）",
    studentNumber: "学籍番号",
    enrollmentYear: "入学年度",
  },
  class: {
    name: "学級名",
    classCode: "学級コード",
    grade: "学年",
    description: "説明",
  },
  subtotalGroup: {
    name: "グループ名",
  },
}

/**
 * 2つのオブジェクトのフィールド変更を検出
 */
function detectFieldChanges(
  importData: Record<string, unknown>,
  existingData: Record<string, unknown>,
  category: "student" | "class" | "subtotalGroup"
): FieldChange[] {
  const changes: FieldChange[] = []
  const labels = FIELD_LABELS[category]

  for (const [field, label] of Object.entries(labels)) {
    const importValue = importData[field]
    const existingValue = existingData[field]

    // 値が異なる場合のみ変更として記録
    if (importValue !== existingValue) {
      // null/undefined/空文字の差異は無視
      const importEmpty =
        importValue === null || importValue === undefined || importValue === ""
      const existingEmpty =
        existingValue === null ||
        existingValue === undefined ||
        existingValue === ""

      if (importEmpty && existingEmpty) continue

      changes.push({
        field,
        fieldLabel: label,
        currentValue: existingValue,
        newValue: importValue,
      })
    }
  }

  return changes
}

/**
 * カテゴリから更新可能なアイテムを抽出
 */
function extractUpdateableItems(
  preMatch: PreMatchingResult,
  config: CategoryIdIntegrationConfig,
  category: "student" | "class" | "subtotalGroup"
): UpdateableItem[] {
  const items: UpdateableItem[] = []

  // 同一人物として紐づけたアイテムを取得
  const getLinkedItems = (): MatchedItem[] => {
    const linked: MatchedItem[] = []

    // ID一致は自動で紐づくが、フィールド変更がある可能性
    linked.push(...preMatch.byId)

    // 学籍番号一致
    if (preMatch.byStudentNumber) {
      for (const match of preMatch.byStudentNumber) {
        const decision = config.decisions.find(
          (d) => d.importId === match.importId
        )
        if (
          config.strategy === "by_student_number" ||
          decision?.decisionType === "same_person"
        ) {
          linked.push(match)
        }
      }
    }

    // 名前一致
    if (preMatch.byName) {
      for (const match of preMatch.byName) {
        // 既に処理済みかチェック
        if (linked.some((l) => l.importId === match.importId)) continue

        const decision = config.decisions.find(
          (d) => d.importId === match.importId
        )
        if (
          config.strategy === "by_name" ||
          decision?.decisionType === "same_person"
        ) {
          linked.push(match)
        }
      }
    }

    return linked
  }

  const linkedItems = getLinkedItems()

  for (const match of linkedItems) {
    const fieldChanges = detectFieldChanges(
      match.importData,
      match.existingData,
      category
    )

    // フィールド変更がある場合のみ追加
    if (fieldChanges.length > 0) {
      items.push({
        id: match.importId,
        category,
        displayLabel: match.displayLabel,
        fieldChanges,
        importData: match.importData,
        existingData: match.existingData,
      })
    }
  }

  return items
}

/**
 * 情報の更新確認ステップ
 *
 * 既存データと紐づけた生徒/学級について、情報を更新するか確認
 * 「現在の情報 → インポート後」を視覚的に表示
 */
export function UpdateConfirmStep({ wizard }: UpdateConfirmStepProps) {
  const {
    state,
    setUpdateDecision,
    setAllUpdateDecisions,
    goToNextStep,
  } = wizard
  const { fileOverviewData, idIntegrationConfig, updateDecisions } = state

  // 更新が必要なアイテムを抽出
  const studentItems = fileOverviewData
    ? extractUpdateableItems(
        fileOverviewData.student,
        idIntegrationConfig.student,
        "student"
      )
    : []

  const classItems = fileOverviewData
    ? extractUpdateableItems(
        fileOverviewData.class,
        idIntegrationConfig.class,
        "class"
      )
    : []

  const subtotalGroupItems = fileOverviewData
    ? extractUpdateableItems(
        fileOverviewData.subtotalGroup,
        idIntegrationConfig.subtotalGroup,
        "subtotalGroup"
      )
    : []

  const allItems = [...studentItems, ...classItems, ...subtotalGroupItems]
  const hasUpdates = allItems.length > 0

  // 更新が必要なアイテムがない場合
  if (!hasUpdates) {
    return (
      <div className="flex h-full flex-col items-center justify-center py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h3 className="mb-2 text-xl font-semibold">情報の更新は不要です</h3>
          <p className="text-muted-foreground max-w-md">
            既存のデータと紐づけたものに変更はありません。
            <br />
            そのままインポートを続行できます。
          </p>
        </div>
        <Button onClick={goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <RefreshCw className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">情報の更新確認</h3>
        <p className="text-muted-foreground">
          既存のデータと紐づけたものに変更があります。
          <br />
          更新するかどうか確認してください。
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-4">
          {/* 生徒 */}
          {studentItems.length > 0 && (
            <CategoryUpdateSection
              icon={<Users className="h-5 w-5" />}
              title="生徒"
              items={studentItems}
              updateDecisions={updateDecisions}
              onUpdateDecision={setUpdateDecision}
              onUpdateAll={(ids, value) => setAllUpdateDecisions(ids, value)}
            />
          )}

          {/* 学級 */}
          {classItems.length > 0 && (
            <CategoryUpdateSection
              icon={<GraduationCap className="h-5 w-5" />}
              title="学級"
              items={classItems}
              updateDecisions={updateDecisions}
              onUpdateDecision={setUpdateDecision}
              onUpdateAll={(ids, value) => setAllUpdateDecisions(ids, value)}
            />
          )}

          {/* 小計グループ */}
          {subtotalGroupItems.length > 0 && (
            <CategoryUpdateSection
              icon={<Layers className="h-5 w-5" />}
              title="小計グループ"
              items={subtotalGroupItems}
              updateDecisions={updateDecisions}
              onUpdateDecision={setUpdateDecision}
              onUpdateAll={(ids, value) => setAllUpdateDecisions(ids, value)}
            />
          )}
        </div>
      </ScrollArea>

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button onClick={goToNextStep} size="lg" className="px-8">
          次へ進む
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// サブコンポーネント
// =============================================================================

interface CategoryUpdateSectionProps {
  icon: React.ReactNode
  title: string
  items: UpdateableItem[]
  updateDecisions: Record<string, boolean>
  onUpdateDecision: (id: string, value: boolean) => void
  onUpdateAll: (ids: string[], value: boolean) => void
}

function CategoryUpdateSection({
  icon,
  title,
  items,
  updateDecisions,
  onUpdateDecision,
  onUpdateAll,
}: CategoryUpdateSectionProps) {
  const allIds = items.map((item) => item.id)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            {icon}
            <CardTitle className="text-base">
              {title}（{items.length}件の変更）
            </CardTitle>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateAll(allIds, true)}
            >
              全て更新
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateAll(allIds, false)}
            >
              全て維持
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <UpdateCard
            key={item.id}
            item={item}
            isChecked={updateDecisions[item.id] ?? true}
            onCheckChange={(checked) => onUpdateDecision(item.id, checked)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface UpdateCardProps {
  item: UpdateableItem
  isChecked: boolean
  onCheckChange: (checked: boolean) => void
}

function UpdateCard({ item, isChecked, onCheckChange }: UpdateCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`update-${item.id}`}
            checked={isChecked}
            onCheckedChange={onCheckChange}
            className="mt-1"
          />
          <div className="flex-1">
            <Label
              htmlFor={`update-${item.id}`}
              className="cursor-pointer font-medium"
            >
              {item.displayLabel}
            </Label>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.fieldChanges.length}項目の変更
            </p>

            {/* 変更内容のプレビュー */}
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-auto p-0 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {isExpanded ? "変更内容を隠す" : "変更内容を表示"}
                  <ChevronDown
                    className={`ml-1 h-4 w-4 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="bg-background mt-3 rounded-md border p-3">
                  <FieldChangeList changes={item.fieldChanges} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

interface FieldChangeListProps {
  changes: FieldChange[]
}

function FieldChangeList({ changes }: FieldChangeListProps) {
  if (changes.length === 0) {
    return <p className="text-muted-foreground text-sm">変更内容はありません</p>
  }

  return (
    <div className="space-y-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-left text-xs">
            <th className="pb-1">項目</th>
            <th className="pb-1">現在の情報</th>
            <th className="pb-1 text-center">→</th>
            <th className="pb-1">インポート後</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change) => (
            <tr key={change.field}>
              <td className="text-muted-foreground py-1">
                {change.fieldLabel}
              </td>
              <td className="py-1">{formatValue(change.currentValue)}</td>
              <td className="py-1 text-center">
                <ArrowRight className="text-muted-foreground inline h-3 w-3" />
              </td>
              <td className="py-1 font-medium text-blue-600 dark:text-blue-400">
                {formatValue(change.newValue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"
  if (typeof value === "boolean") return value ? "はい" : "いいえ"
  return String(value)
}
