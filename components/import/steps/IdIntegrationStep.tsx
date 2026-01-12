"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ClassMatchingStrategy,
  IdChoice,
  MatchedItem,
  StudentMatchingStrategy,
  SubtotalGroupMatchingStrategy,
} from "@/types/projectArchive.types"
import { Layers, Loader2, School, Settings, Users } from "lucide-react"
import { useState } from "react"

interface IdIntegrationStepProps {
  wizard: UseImportWizardReturn
}

type CategoryType = "student" | "class" | "subtotalGroup"

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

/**
 * 生徒の統合パネル
 */
interface StudentIntegrationPanelProps {
  wizard: UseImportWizardReturn
  onStrategyChange: (strategy: StudentMatchingStrategy) => void
}

function StudentIntegrationPanel({
  wizard,
  onStrategyChange,
}: StudentIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.student
  const strategy = state.idIntegrationConfig.student
    .strategy as StudentMatchingStrategy

  if (!overview) return null

  const byStudentNumberCount = overview.byStudentNumber?.length ?? 0
  const byNameCount = overview.byName?.length ?? 0
  const noMatchCount = overview.noMatch.length
  const needsDecisionCount = byStudentNumberCount + byNameCount + noMatchCount

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての生徒が自動で紐づきました
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            判断が必要な生徒が{needsDecisionCount}名います
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            どうやって既存の生徒と紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) =>
              onStrategyChange(v as StudentMatchingStrategy)
            }
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_student_number"
                id="student-by-number"
                label={`学籍番号で紐づける (${byStudentNumberCount}名が一致)`}
                description="学籍番号が同じ生徒と紐づけます"
                recommended={byStudentNumberCount > 0}
              />
              <StrategyOption
                value="by_name"
                id="student-by-name"
                label={`氏名で紐づける (${byNameCount}名が一致)`}
                description="姓と名が同じ生徒と紐づけます"
              />
              <StrategyOption
                value="individual"
                id="student-individual"
                label="1人ずつ設定する"
                description="各生徒について個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="student-all-new"
                label="全員を新しい生徒として追加する"
                description="既存の生徒とは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_student_number" ||
        strategy === "by_name" ||
        strategy === "individual") && (
        <StudentDetailPanel
          wizard={wizard}
          strategy={strategy}
          byStudentNumber={overview.byStudentNumber ?? []}
          byName={overview.byName ?? []}
          noMatch={overview.noMatch}
        />
      )}
    </div>
  )
}

/**
 * 学級の統合パネル
 */
interface ClassIntegrationPanelProps {
  wizard: UseImportWizardReturn
  onStrategyChange: (strategy: ClassMatchingStrategy) => void
}

function ClassIntegrationPanel({
  wizard,
  onStrategyChange,
}: ClassIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.class
  const strategy = state.idIntegrationConfig.class
    .strategy as ClassMatchingStrategy

  if (!overview) return null

  const byNameCount = overview.byName?.length ?? 0
  const noMatchCount = overview.noMatch.length
  const needsDecisionCount = byNameCount + noMatchCount

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての学級が自動で紐づきました
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            判断が必要な学級が{needsDecisionCount}クラスあります
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            どうやって既存の学級と紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) => onStrategyChange(v as ClassMatchingStrategy)}
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_name"
                id="class-by-name"
                label={`学級名で紐づける (${byNameCount}クラスが一致)`}
                description="学級名が同じ学級と紐づけます"
                recommended={byNameCount > 0}
              />
              <StrategyOption
                value="individual"
                id="class-individual"
                label="1つずつ設定する"
                description="各学級について個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="class-all-new"
                label="全て新しい学級として追加する"
                description="既存の学級とは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_name" || strategy === "individual") && (
        <ClassDetailPanel
          wizard={wizard}
          strategy={strategy}
          byName={overview.byName ?? []}
          noMatch={overview.noMatch}
        />
      )}
    </div>
  )
}

/**
 * 小計グループの統合パネル
 */
interface SubtotalGroupIntegrationPanelProps {
  wizard: UseImportWizardReturn
  onStrategyChange: (strategy: SubtotalGroupMatchingStrategy) => void
}

function SubtotalGroupIntegrationPanel({
  wizard,
  onStrategyChange,
}: SubtotalGroupIntegrationPanelProps) {
  const { state } = wizard
  const overview = state.fileOverviewData?.subtotalGroup
  const strategy = state.idIntegrationConfig.subtotalGroup
    .strategy as SubtotalGroupMatchingStrategy

  if (!overview) return null

  const byNameCount = overview.byName?.length ?? 0
  const noMatchCount = overview.noMatch.length
  const needsDecisionCount = byNameCount + noMatchCount

  if (needsDecisionCount === 0) {
    return (
      <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
        <CardContent className="p-4 text-center">
          <p className="text-green-700 dark:text-green-300">
            すべての小計グループが自動で紐づきました
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            判断が必要な小計グループが{needsDecisionCount}グループあります
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            どうやって既存の小計グループと紐づけますか？
          </p>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={strategy}
            onValueChange={(v) =>
              onStrategyChange(v as SubtotalGroupMatchingStrategy)
            }
          >
            <div className="space-y-3">
              <StrategyOption
                value="by_name"
                id="subtotal-by-name"
                label={`グループ名で紐づける (${byNameCount}グループが一致)`}
                description="グループ名が同じ小計グループと紐づけます"
                recommended={byNameCount > 0}
              />
              <StrategyOption
                value="individual"
                id="subtotal-individual"
                label="1つずつ設定する"
                description="各グループについて個別に設定します"
              />
              <StrategyOption
                value="all_new"
                id="subtotal-all-new"
                label="全て新しいグループとして追加する"
                description="既存のグループとは紐づけません"
              />
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* 紐づけ方法選択後の詳細UI */}
      {(strategy === "by_name" || strategy === "individual") && (
        <SubtotalGroupDetailPanel
          wizard={wizard}
          strategy={strategy}
          byName={overview.byName ?? []}
          noMatch={overview.noMatch}
        />
      )}
    </div>
  )
}

/**
 * 方針選択オプション
 */
interface StrategyOptionProps {
  value: string
  id: string
  label: string
  description: string
  recommended?: boolean
}

function StrategyOption({
  value,
  id,
  label,
  description,
  recommended,
}: StrategyOptionProps) {
  return (
    <div className="flex items-start space-x-3">
      <RadioGroupItem value={value} id={id} />
      <div className="flex-1">
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
          {recommended && (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              推奨
            </span>
          )}
        </Label>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </div>
  )
}

/**
 * 生徒の詳細パネル（紐づけ確認UI）
 */
interface StudentDetailPanelProps {
  wizard: UseImportWizardReturn
  strategy: StudentMatchingStrategy
  byStudentNumber: MatchedItem[]
  byName: MatchedItem[]
  noMatch: Array<{ importId: string; displayLabel: string }>
}

function StudentDetailPanel({
  wizard,
  strategy,
  byStudentNumber,
  byName,
  noMatch,
}: StudentDetailPanelProps) {
  const { updateIdIntegrationDecision } = wizard

  // 表示するアイテムを決定
  const items =
    strategy === "by_student_number"
      ? byStudentNumber
      : strategy === "by_name"
        ? byName
        : [...byStudentNumber, ...byName]

  if (items.length === 0 && noMatch.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">生徒の紐づけ確認</CardTitle>
        <p className="text-muted-foreground text-sm">
          {strategy === "individual"
            ? "各生徒についてどうするか選んでください"
            : "照合結果です。必要に応じて変更できます。"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* マッチしたアイテム */}
          {items.map((item) => (
            <MatchedItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision, idChoice) =>
                updateIdIntegrationDecision("student", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                  existingId: item.existingId,
                  idChoice,
                })
              }
            />
          ))}

          {/* マッチしなかったアイテム */}
          {noMatch.map((item) => (
            <NoMatchItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision("student", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * マッチしたアイテムの行
 */
interface MatchedItemRowProps {
  item: MatchedItem
  onDecisionChange: (
    decision: "same_person" | "create_new" | "skip",
    idChoice?: IdChoice
  ) => void
}

function MatchedItemRow({ item, onDecisionChange }: MatchedItemRowProps) {
  const [decision, setDecision] = useState<
    "same_person" | "create_new" | "skip"
  >("same_person")
  const [idChoice, setIdChoice] = useState<IdChoice>("use_existing_id")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "same_person" | "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(
      newDecision,
      newDecision === "same_person" ? idChoice : undefined
    )
  }

  const handleIdChoiceChange = (value: string) => {
    const newIdChoice = value as IdChoice
    setIdChoice(newIdChoice)
    onDecisionChange(decision, newIdChoice)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          {item.matchReason}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Select value={decision} onValueChange={handleDecisionChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same_person">
              このPCの生徒と同じ人として扱う
            </SelectItem>
            <SelectItem value="create_new">新しい生徒として登録する</SelectItem>
            <SelectItem value="skip">取り込まない</SelectItem>
          </SelectContent>
        </Select>

        {/* 同じ人の場合のID選択 */}
        {decision === "same_person" && (
          <div className="mt-1 ml-4">
            <p className="text-muted-foreground mb-1 text-xs">
              どちらに合わせる？
            </p>
            <Select value={idChoice} onValueChange={handleIdChoiceChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use_existing_id">
                  このPCに合わせる
                </SelectItem>
                <SelectItem value="use_import_id">
                  書き出したPCに合わせる
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * マッチしなかったアイテムの行
 */
interface NoMatchItemRowProps {
  item: { importId: string; displayLabel: string }
  onDecisionChange: (decision: "create_new" | "skip") => void
}

function NoMatchItemRow({ item, onDecisionChange }: NoMatchItemRowProps) {
  const [decision, setDecision] = useState<"create_new" | "skip">("create_new")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(newDecision)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          このPCに同じデータなし
        </span>
      </div>
      <Select value={decision} onValueChange={handleDecisionChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="create_new">新しく登録する</SelectItem>
          <SelectItem value="skip">取り込まない</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * 学級の詳細パネル（紐づけ確認UI）
 */
interface ClassDetailPanelProps {
  wizard: UseImportWizardReturn
  strategy: ClassMatchingStrategy
  byName: MatchedItem[]
  noMatch: Array<{ importId: string; displayLabel: string }>
}

function ClassDetailPanel({
  wizard,
  strategy,
  byName,
  noMatch,
}: ClassDetailPanelProps) {
  const { updateIdIntegrationDecision } = wizard

  // 表示するアイテムを決定
  const items = strategy === "by_name" ? byName : byName

  if (items.length === 0 && noMatch.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">学級の紐づけ確認</CardTitle>
        <p className="text-muted-foreground text-sm">
          {strategy === "individual"
            ? "各学級についてどうするか選んでください"
            : "照合結果です。必要に応じて変更できます。"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* マッチしたアイテム */}
          {items.map((item) => (
            <ClassMatchedItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision, idChoice) =>
                updateIdIntegrationDecision("class", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                  existingId: item.existingId,
                  idChoice,
                })
              }
            />
          ))}

          {/* マッチしなかったアイテム */}
          {noMatch.map((item) => (
            <ClassNoMatchItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision("class", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 学級のマッチしたアイテムの行
 */
interface ClassMatchedItemRowProps {
  item: MatchedItem
  onDecisionChange: (
    decision: "same_person" | "create_new" | "skip",
    idChoice?: IdChoice
  ) => void
}

function ClassMatchedItemRow({
  item,
  onDecisionChange,
}: ClassMatchedItemRowProps) {
  const [decision, setDecision] = useState<
    "same_person" | "create_new" | "skip"
  >("same_person")
  const [idChoice, setIdChoice] = useState<IdChoice>("use_existing_id")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "same_person" | "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(
      newDecision,
      newDecision === "same_person" ? idChoice : undefined
    )
  }

  const handleIdChoiceChange = (value: string) => {
    const newIdChoice = value as IdChoice
    setIdChoice(newIdChoice)
    onDecisionChange(decision, newIdChoice)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          {item.matchReason}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Select value={decision} onValueChange={handleDecisionChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same_person">
              このPCの学級と同じものとして扱う
            </SelectItem>
            <SelectItem value="create_new">新しい学級として登録する</SelectItem>
            <SelectItem value="skip">取り込まない</SelectItem>
          </SelectContent>
        </Select>

        {/* 同じ学級の場合のID選択 */}
        {decision === "same_person" && (
          <div className="mt-1 ml-4">
            <p className="text-muted-foreground mb-1 text-xs">
              どちらに合わせる？
            </p>
            <Select value={idChoice} onValueChange={handleIdChoiceChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use_existing_id">
                  このPCに合わせる
                </SelectItem>
                <SelectItem value="use_import_id">
                  書き出したPCに合わせる
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 学級のマッチしなかったアイテムの行
 */
interface ClassNoMatchItemRowProps {
  item: { importId: string; displayLabel: string }
  onDecisionChange: (decision: "create_new" | "skip") => void
}

function ClassNoMatchItemRow({
  item,
  onDecisionChange,
}: ClassNoMatchItemRowProps) {
  const [decision, setDecision] = useState<"create_new" | "skip">("create_new")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(newDecision)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          このPCに同じデータなし
        </span>
      </div>
      <Select value={decision} onValueChange={handleDecisionChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="create_new">新しく登録する</SelectItem>
          <SelectItem value="skip">取り込まない</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * 小計グループの詳細パネル（紐づけ確認UI）
 */
interface SubtotalGroupDetailPanelProps {
  wizard: UseImportWizardReturn
  strategy: SubtotalGroupMatchingStrategy
  byName: MatchedItem[]
  noMatch: Array<{ importId: string; displayLabel: string }>
}

function SubtotalGroupDetailPanel({
  wizard,
  strategy,
  byName,
  noMatch,
}: SubtotalGroupDetailPanelProps) {
  const { updateIdIntegrationDecision } = wizard

  // 表示するアイテムを決定
  const items = strategy === "by_name" ? byName : byName

  if (items.length === 0 && noMatch.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">小計グループの紐づけ確認</CardTitle>
        <p className="text-muted-foreground text-sm">
          {strategy === "individual"
            ? "各グループについてどうするか選んでください"
            : "照合結果です。必要に応じて変更できます。"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* マッチしたアイテム */}
          {items.map((item) => (
            <SubtotalGroupMatchedItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision, idChoice) =>
                updateIdIntegrationDecision("subtotalGroup", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                  existingId: item.existingId,
                  idChoice,
                })
              }
            />
          ))}

          {/* マッチしなかったアイテム */}
          {noMatch.map((item) => (
            <SubtotalGroupNoMatchItemRow
              key={item.importId}
              item={item}
              onDecisionChange={(decision) =>
                updateIdIntegrationDecision("subtotalGroup", item.importId, {
                  importId: item.importId,
                  decisionType: decision,
                })
              }
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * 小計グループのマッチしたアイテムの行
 */
interface SubtotalGroupMatchedItemRowProps {
  item: MatchedItem
  onDecisionChange: (
    decision: "same_person" | "create_new" | "skip",
    idChoice?: IdChoice
  ) => void
}

function SubtotalGroupMatchedItemRow({
  item,
  onDecisionChange,
}: SubtotalGroupMatchedItemRowProps) {
  const [decision, setDecision] = useState<
    "same_person" | "create_new" | "skip"
  >("same_person")
  const [idChoice, setIdChoice] = useState<IdChoice>("use_existing_id")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "same_person" | "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(
      newDecision,
      newDecision === "same_person" ? idChoice : undefined
    )
  }

  const handleIdChoiceChange = (value: string) => {
    const newIdChoice = value as IdChoice
    setIdChoice(newIdChoice)
    onDecisionChange(decision, newIdChoice)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          {item.matchReason}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <Select value={decision} onValueChange={handleDecisionChange}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="same_person">
              このPCのグループと同じものとして扱う
            </SelectItem>
            <SelectItem value="create_new">
              新しいグループとして登録する
            </SelectItem>
            <SelectItem value="skip">取り込まない</SelectItem>
          </SelectContent>
        </Select>

        {/* 同じグループの場合のID選択 */}
        {decision === "same_person" && (
          <div className="mt-1 ml-4">
            <p className="text-muted-foreground mb-1 text-xs">
              どちらに合わせる？
            </p>
            <Select value={idChoice} onValueChange={handleIdChoiceChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use_existing_id">
                  このPCに合わせる
                </SelectItem>
                <SelectItem value="use_import_id">
                  書き出したPCに合わせる
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 小計グループのマッチしなかったアイテムの行
 */
interface SubtotalGroupNoMatchItemRowProps {
  item: { importId: string; displayLabel: string }
  onDecisionChange: (decision: "create_new" | "skip") => void
}

function SubtotalGroupNoMatchItemRow({
  item,
  onDecisionChange,
}: SubtotalGroupNoMatchItemRowProps) {
  const [decision, setDecision] = useState<"create_new" | "skip">("create_new")

  const handleDecisionChange = (value: string) => {
    const newDecision = value as "create_new" | "skip"
    setDecision(newDecision)
    onDecisionChange(newDecision)
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.displayLabel}</span>
        <span className="text-muted-foreground text-xs">
          このPCに同じデータなし
        </span>
      </div>
      <Select value={decision} onValueChange={handleDecisionChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="create_new">新しく登録する</SelectItem>
          <SelectItem value="skip">取り込まない</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
