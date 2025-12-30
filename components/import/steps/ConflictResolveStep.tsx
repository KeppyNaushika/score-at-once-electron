"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import type { UseImportWizardReturn } from "@/hooks/import/useImportWizard"
import type {
  ConflictCategory,
  ConflictPolicy,
  CategoryMatchingResult,
} from "@/types/projectArchive.types"
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Download,
  Database,
  Users,
  School,
  UserCircle,
  FileText,
  ClipboardCheck,
  Pencil,
  Layers,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ConflictResolveStepProps {
  wizard: UseImportWizardReturn
}

const CATEGORY_CONFIG: Record<
  ConflictCategory,
  { label: string; icon: React.ReactNode }
> = {
  Student: { label: "生徒", icon: <Users className="h-4 w-4" /> },
  Class: { label: "学級", icon: <School className="h-4 w-4" /> },
  User: { label: "ユーザー", icon: <UserCircle className="h-4 w-4" /> },
  Project: { label: "プロジェクト", icon: <FileText className="h-4 w-4" /> },
  SubtotalGroup: {
    label: "小計グループ",
    icon: <Layers className="h-4 w-4" />,
  },
  QuestionScore: {
    label: "採点結果",
    icon: <ClipboardCheck className="h-4 w-4" />,
  },
  DrawingAnnotation: {
    label: "描画アノテーション",
    icon: <Pencil className="h-4 w-4" />,
  },
}

const POLICY_OPTIONS: Array<{
  value: ConflictPolicy
  label: string
  description: string
  icon: React.ReactNode
}> = [
  {
    value: "timestamp",
    label: "タイムスタンプで自動判定",
    description: "更新日時が新しい方を採用します",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    value: "import_wins",
    label: "インポートデータで上書き",
    description: "インポートファイルのデータで上書きします",
    icon: <Download className="h-4 w-4" />,
  },
  {
    value: "existing_wins",
    label: "既存データを維持",
    description: "現在のデータを保持し、新規データのみ追加します",
    icon: <Database className="h-4 w-4" />,
  },
]

interface CategoryCardProps {
  result: CategoryMatchingResult
  policy: ConflictPolicy
  onPolicyChange: (policy: ConflictPolicy) => void
}

function CategoryCard({ result, policy, onPolicyChange }: CategoryCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const hasConflicts = result.conflictItems.length > 0
  const config = CATEGORY_CONFIG[result.category]

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card
        className={cn(hasConflicts && "border-amber-200 dark:border-amber-800")}
      >
        <CollapsibleTrigger asChild>
          <CardHeader className="hover:bg-muted/50 cursor-pointer py-4 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    hasConflicts
                      ? "bg-amber-100 dark:bg-amber-900/30"
                      : "bg-green-100 dark:bg-green-900/30"
                  )}
                >
                  {hasConflicts ? (
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div>
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    {config.icon}
                    {config.label}
                  </CardTitle>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      一致 {result.summary.matched}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      新規 {result.summary.newItems}
                    </Badge>
                    {hasConflicts && (
                      <Badge
                        variant="outline"
                        className="border-amber-200 bg-amber-50 text-xs text-amber-600 dark:bg-amber-950"
                      >
                        競合 {result.summary.conflicts}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              {hasConflicts && (
                <ChevronDown
                  className={cn(
                    "text-muted-foreground h-5 w-5 transition-transform",
                    isOpen && "rotate-180"
                  )}
                />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        {hasConflicts && (
          <CollapsibleContent>
            <CardContent className="border-t pt-0">
              {/* ポリシー選択 */}
              <div className="py-4">
                <p className="mb-3 text-sm font-medium">競合の解決方法</p>
                <RadioGroup
                  value={policy}
                  onValueChange={(v) => onPolicyChange(v as ConflictPolicy)}
                  className="gap-2"
                >
                  {POLICY_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`policy-${result.category}-${option.value}`}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                        policy === option.value
                          ? "bg-primary/5 border-primary"
                          : "hover:bg-muted/50 border-transparent bg-transparent"
                      )}
                    >
                      <RadioGroupItem
                        id={`policy-${result.category}-${option.value}`}
                        value={option.value}
                        className="mt-0.5"
                      />
                      <div className="flex items-center gap-2">
                        {option.icon}
                        <div>
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                          <p className="text-muted-foreground text-xs">
                            {option.description}
                          </p>
                        </div>
                      </div>
                    </Label>
                  ))}
                </RadioGroup>
              </div>

              {/* 競合アイテム一覧（プレビュー） */}
              <div className="border-t pt-4">
                <p className="mb-2 text-sm font-medium">
                  競合しているデータ ({result.conflictItems.length}件)
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                          項目
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                          既存データ
                        </th>
                        <th className="text-muted-foreground px-3 py-2 text-left text-xs font-medium">
                          インポートデータ
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {result.conflictItems.slice(0, 10).map((item) => (
                        <tr key={item.id} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">
                            {item.displayLabel || item.id.slice(0, 8)}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-xs">
                            {formatTimestamp(item.existingData)}
                          </td>
                          <td className="text-muted-foreground px-3 py-2 text-xs">
                            {formatTimestamp(item.importData)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.conflictItems.length > 10 && (
                    <div className="text-muted-foreground bg-muted/30 border-t px-3 py-2 text-center text-xs">
                      他 {result.conflictItems.length - 10} 件...
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        )}
      </Card>
    </Collapsible>
  )
}

function formatTimestamp(data: Record<string, unknown>): string {
  if (data.updatedAt) {
    return new Date(data.updatedAt as string).toLocaleString("ja-JP")
  }
  return "-"
}

export function ConflictResolveStep({ wizard }: ConflictResolveStepProps) {
  const { state, updateConflictResolution, proceedToExecute } = wizard

  const results = state.conflictDetectionResult?.results || []
  const hasAnyConflicts = results.some((r) => r.conflictItems.length > 0)

  const totalMatched = results.reduce((sum, r) => sum + r.summary.matched, 0)
  const totalNew = results.reduce((sum, r) => sum + r.summary.newItems, 0)
  const totalConflicts = results.reduce(
    (sum, r) => sum + r.summary.conflicts,
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-lg font-semibold">競合解決</h3>
        <p className="text-muted-foreground text-sm">
          {hasAnyConflicts
            ? "以下のデータに競合があります。カテゴリごとに解決方法を選択してください。"
            : "競合はありません。そのままインポートを実行できます。"}
        </p>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {totalMatched}
            </div>
            <div className="mt-1 text-xs text-green-600/80 dark:text-green-400/80">
              一致
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {totalNew}
            </div>
            <div className="mt-1 text-xs text-blue-600/80 dark:text-blue-400/80">
              新規追加
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
              {totalConflicts}
            </div>
            <div className="mt-1 text-xs text-amber-600/80 dark:text-amber-400/80">
              競合
            </div>
          </CardContent>
        </Card>
      </div>

      {/* カテゴリ別カード */}
      <div className="space-y-3">
        {results.map((result) => (
          <CategoryCard
            key={result.category}
            result={result}
            policy={
              state.conflictResolutions[result.category]?.policy || "timestamp"
            }
            onPolicyChange={(policy) =>
              updateConflictResolution(result.category, { policy })
            }
          />
        ))}
      </div>

      {/* 次へボタン */}
      <div className="flex justify-end pt-4">
        <Button onClick={proceedToExecute} className="gap-2">
          インポートを実行
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
