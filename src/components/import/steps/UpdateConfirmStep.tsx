"use client"

import { GraduationCap, Layers, RefreshCw, Users } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  CategoryIdIntegrationConfig,
  MatchedItem,
  PreMatchingResult,
  ScoringConflictResolutionStrategy,
} from "@/types/examArchive.types"

type UpdateStrategy = "keep_existing" | "use_import" | "use_newer"

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
  category: "student" | "classroom" | "subtotalGroup"
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
  classroom: {
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
  category: "student" | "classroom" | "subtotalGroup"
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
  category: "student" | "classroom" | "subtotalGroup"
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
          (candidateDecision) => candidateDecision.importId === match.importId
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
        if (linked.some((linkedItem) => linkedItem.importId === match.importId))
          continue

        const decision = config.decisions.find(
          (candidateDecision) => candidateDecision.importId === match.importId
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
 * 既存データと紐づけた生徒/学級について、フィールド単位で更新方法を選択
 * テーブル形式で「このPC」「ファイルに従う」「新しい方に従う」のラジオ選択
 */
export function UpdateConfirmStep({ wizard }: UpdateConfirmStepProps) {
  const {
    state,
    setFieldUpdateDecision,
    setBulkUpdateStrategy,
    setScoringConflictStrategy,
    goToNextStep,
  } = wizard
  const {
    fileOverviewData,
    idIntegrationConfig,
    updateDecisions,
    scoringConflictConfig,
  } = state

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
        fileOverviewData.classroom,
        idIntegrationConfig.classroom,
        "classroom"
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

  return (
    <div className="flex h-full flex-col">
      {/* ヘッダー */}
      <div className="mb-6 text-center">
        <div className="bg-primary/10 mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl">
          <RefreshCw className="text-primary h-10 w-10" />
        </div>
        <h3 className="mb-2 text-xl font-semibold">データの更新設定</h3>
        <p className="text-muted-foreground">
          採点データの統合方針と、既存データの更新方法を設定してください。
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 pb-4">
          {/* 採点データの統合方針 */}
          <ScoringStrategySection
            strategy={scoringConflictConfig.strategy}
            onStrategyChange={setScoringConflictStrategy}
          />

          {/* フィールド更新 */}
          {hasUpdates ? (
            <>
              <div className="text-muted-foreground text-center text-sm">
                以下のデータに変更があります。フィールドごとに更新方法を選択してください。
              </div>

              {/* 生徒 */}
              {studentItems.length > 0 && (
                <CategoryUpdateSection
                  icon={<Users className="h-5 w-5" />}
                  title="生徒"
                  items={studentItems}
                  updateDecisions={updateDecisions}
                  onFieldDecision={setFieldUpdateDecision}
                  onBulkStrategy={setBulkUpdateStrategy}
                />
              )}

              {/* 学級 */}
              {classItems.length > 0 && (
                <CategoryUpdateSection
                  icon={<GraduationCap className="h-5 w-5" />}
                  title="学級"
                  items={classItems}
                  updateDecisions={updateDecisions}
                  onFieldDecision={setFieldUpdateDecision}
                  onBulkStrategy={setBulkUpdateStrategy}
                />
              )}

              {/* 小計グループ */}
              {subtotalGroupItems.length > 0 && (
                <CategoryUpdateSection
                  icon={<Layers className="h-5 w-5" />}
                  title="小計グループ"
                  items={subtotalGroupItems}
                  updateDecisions={updateDecisions}
                  onFieldDecision={setFieldUpdateDecision}
                  onBulkStrategy={setBulkUpdateStrategy}
                />
              )}
            </>
          ) : (
            <div className="text-muted-foreground text-center text-sm">
              生徒・学級・小計グループの情報に変更はありません。
            </div>
          )}
        </div>
      </ScrollArea>

      {/* 次へボタン */}
      <div className="mt-6 flex justify-center">
        <Button onClick={goToNextStep} size="lg" className="px-8">
          次へ
        </Button>
      </div>
    </div>
  )
}

// =============================================================================
// サブコンポーネント
// =============================================================================

interface ScoringStrategySectionProps {
  strategy: ScoringConflictResolutionStrategy
  onStrategyChange: (strategy: ScoringConflictResolutionStrategy) => void
}

function ScoringStrategySection({
  strategy,
  onStrategyChange,
}: ScoringStrategySectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">採点データの統合方針</CardTitle>
        <p className="text-muted-foreground text-sm">
          同じ生徒の同じ設問に対して、ファイルとこのPCで異なる採点がある場合の扱いを選択してください。
        </p>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={strategy}
          onValueChange={(v) =>
            onStrategyChange(v as ScoringConflictResolutionStrategy)
          }
          className="space-y-3"
        >
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem
              value="newer_wins"
              id="scoring-newer"
              className="mt-0.5"
            />
            <Label htmlFor="scoring-newer" className="flex-1 cursor-pointer">
              <div className="font-medium">新しい方を優先</div>
              <div className="text-muted-foreground text-sm">
                更新日時が新しい採点結果を採用します
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem
              value="existing_wins"
              id="scoring-existing"
              className="mt-0.5"
            />
            <Label htmlFor="scoring-existing" className="flex-1 cursor-pointer">
              <div className="font-medium">このPCを優先</div>
              <div className="text-muted-foreground text-sm">
                このPCの採点結果を維持します
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <RadioGroupItem
              value="import_wins"
              id="scoring-import"
              className="mt-0.5"
            />
            <Label htmlFor="scoring-import" className="flex-1 cursor-pointer">
              <div className="font-medium">ファイルを優先</div>
              <div className="text-muted-foreground text-sm">
                ファイルの採点結果で上書きします
              </div>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

interface CategoryUpdateSectionProps {
  icon: React.ReactNode
  title: string
  items: UpdateableItem[]
  updateDecisions: Record<string, Record<string, UpdateStrategy>>
  onFieldDecision: (
    itemKey: string,
    field: string,
    strategy: UpdateStrategy
  ) => void
  onBulkStrategy: (
    itemKeys: string[],
    fields: string[],
    strategy: UpdateStrategy
  ) => void
}

function CategoryUpdateSection({
  icon,
  title,
  items,
  updateDecisions,
  onFieldDecision,
  onBulkStrategy,
}: CategoryUpdateSectionProps) {
  const allItemKeys = items.map((item) => `${item.category}:${item.id}`)
  const allFields = [
    ...new Set(
      items.flatMap((item) => item.fieldChanges.map((change) => change.field))
    ),
  ]

  const handleBulk = (strategy: UpdateStrategy) => {
    onBulkStrategy(allItemKeys, allFields, strategy)
  }

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
              onClick={() => handleBulk("keep_existing")}
            >
              すべてこのPC
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulk("use_import")}
            >
              すべてファイルに従う
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulk("use_newer")}
            >
              すべて新しい方に従う
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => {
          const itemKey = `${item.category}:${item.id}`
          return (
            <UpdateCard
              key={itemKey}
              item={item}
              itemKey={itemKey}
              fieldDecisions={updateDecisions[itemKey] ?? {}}
              onFieldDecision={onFieldDecision}
            />
          )
        })}
      </CardContent>
    </Card>
  )
}

interface UpdateCardProps {
  item: UpdateableItem
  itemKey: string
  fieldDecisions: Record<string, UpdateStrategy>
  onFieldDecision: (
    itemKey: string,
    field: string,
    strategy: UpdateStrategy
  ) => void
}

function UpdateCard({
  item,
  itemKey,
  fieldDecisions,
  onFieldDecision,
}: UpdateCardProps) {
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="mb-3 font-medium">{item.displayLabel}</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-xs">
              <th className="pb-2">項目</th>
              <th className="pb-2">このPC</th>
              <th className="pb-2">ファイル</th>
              <th className="pb-2">選択</th>
            </tr>
          </thead>
          <tbody>
            {item.fieldChanges.map((change) => {
              const currentStrategy: UpdateStrategy =
                fieldDecisions[change.field] ?? "use_newer"
              return (
                <tr key={change.field} className="border-muted border-t">
                  <td className="text-muted-foreground py-2 pr-2">
                    {change.fieldLabel}
                  </td>
                  <td className="py-2 pr-2">
                    {formatValue(change.currentValue)}
                  </td>
                  <td className="py-2 pr-2 font-medium text-blue-600 dark:text-blue-400">
                    {formatValue(change.newValue)}
                  </td>
                  <td className="py-2">
                    <RadioGroup
                      value={currentStrategy}
                      onValueChange={(v) =>
                        onFieldDecision(
                          itemKey,
                          change.field,
                          v as UpdateStrategy
                        )
                      }
                      className="flex gap-3"
                    >
                      <div className="flex items-center gap-1">
                        <RadioGroupItem
                          value="keep_existing"
                          id={`${itemKey}-${change.field}-keep`}
                        />
                        <Label
                          htmlFor={`${itemKey}-${change.field}-keep`}
                          className="text-xs"
                        >
                          このPC
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem
                          value="use_import"
                          id={`${itemKey}-${change.field}-import`}
                        />
                        <Label
                          htmlFor={`${itemKey}-${change.field}-import`}
                          className="text-xs"
                        >
                          ファイル
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <RadioGroupItem
                          value="use_newer"
                          id={`${itemKey}-${change.field}-newer`}
                        />
                        <Label
                          htmlFor={`${itemKey}-${change.field}-newer`}
                          className="text-xs"
                        >
                          新しい方
                        </Label>
                      </div>
                    </RadioGroup>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
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
