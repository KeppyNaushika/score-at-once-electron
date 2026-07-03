"use client"

import { Trash2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useGradeConstraints } from "@/hooks/grades/useGradeConstraints"
import {
  DEFAULT_CONSISTENCY_CONFIG,
  DEFAULT_CONSTRAINT_COLOR,
  DEFAULT_MUTUAL_EXCLUSION_CONFIG,
  evaluateConstraints,
  validateConstraintExpression,
} from "@/lib/gradeConstraints"
import type {
  GradeBoundarySetWithDetails,
  GradeCalculationResult,
  GradeConstraintData,
  GradeConstraintInput,
  GradeConstraintKind,
} from "@/types/grade.types"

import { ConsistencyFields, parseConsistency } from "./ConsistencyFields"
import {
  MutualExclusionFields,
  parseMutualExclusion,
} from "./MutualExclusionFields"

interface ConstraintRulesEditorProps {
  gradeId: string
  gradeItems: { id: string; name: string; order: number }[]
  boundarySets: GradeBoundarySetWithDetails[]
}

const KIND_LABELS: Record<GradeConstraintKind, string> = {
  consistency: "整合（観点集計と評定）",
  mutual_exclusion: "混在禁止",
  expression: "上級: 式",
}

const EXPRESSION_HELP = [
  "式が真になった生徒を着色します。関数名は英語、項目名・ラベルはダブルクォートで囲みます。",
  "すべて GradeItem（評定・観点など）同士の比較です。",
  '例: has("A") and has("C")   … A と C が混在',
  '例: label("評定") == "5" and count("A") < 3   … 評定5なのにAが3つ未満',
  '例: label("態度") == "A" and item("評定") < 4   … 態度Aなのに評定が低い',
  "使える関数: item(項目) / label(項目) / has(ラベル) / count(ラベル) / sum(項目…) / mean(項目…) / min(項目…) / max(項目…) / abs()",
  "  ※ item()の数値: 数値ラベル(5..1)はそのまま、A/B/Cは弱→強の順位(1,2,3…)。",
  "     A=5,B=3,C=1 のような換算で評定と直接比べたい時は「整合ルール」を使ってください。",
  "演算子: and / or / not / == / != / > / < / >= / <=",
].join("\n")

/** boundarySets から観点別評価に登場しうるラベルの一覧を作る */
function collectLabels(boundarySets: GradeBoundarySetWithDetails[]): string[] {
  const set = new Set<string>()
  for (const boundarySet of boundarySets) {
    if (boundarySet.targetType !== "grade_item") continue
    for (const boundary of boundarySet.boundaries) set.add(boundary.label)
  }
  return Array.from(set)
}

/** 「評定」にあたる項目を推測（名前に「評定」を含む最後の項目、無ければ末尾） */
function guessTargetItem(itemNames: string[]): string {
  const byName = [...itemNames]
    .reverse()
    .find((itemName) => itemName.includes("評定"))
  return byName ?? itemNames[itemNames.length - 1] ?? ""
}

function defaultConfigFor(kind: GradeConstraintKind): string {
  if (kind === "consistency") return JSON.stringify(DEFAULT_CONSISTENCY_CONFIG)
  if (kind === "mutual_exclusion")
    return JSON.stringify(DEFAULT_MUTUAL_EXCLUSION_CONFIG)
  return "{}"
}

export function ConstraintRulesEditor({
  gradeId,
  gradeItems,
  boundarySets,
}: ConstraintRulesEditorProps) {
  const { constraints, createConstraint, updateConstraint, deleteConstraint } =
    useGradeConstraints(gradeId)

  const [calcResult, setCalcResult] = useState<GradeCalculationResult | null>(
    null
  )

  const labels = useMemo(() => collectLabels(boundarySets), [boundarySets])
  // 項目名は同期的に得られる gradeItems から作る（calcResult の読込を待たない）
  const itemNames = useMemo(
    () => gradeItems.map((gradeItem) => gradeItem.name),
    [gradeItems]
  )

  // プレビュー用に成績算出結果を取得
  const loadCalc = useCallback(async () => {
    try {
      const res = await window.electronAPI.grade.calculateGrades(gradeId)
      if (res.success && res.result) setCalcResult(res.result)
    } catch (error) {
      console.error("Error calculating grades for preview:", error)
    }
  }, [gradeId])

  useEffect(() => {
    loadCalc()
  }, [loadCalc])

  const evaluation = useMemo(() => {
    if (!calcResult) return null
    return evaluateConstraints(calcResult, constraints)
  }, [calcResult, constraints])

  const handleAdd = async (kind: GradeConstraintKind) => {
    let config = defaultConfigFor(kind)
    // 整合ルールは現在の項目構成から「評定」と集計対象を推測して初期化
    if (kind === "consistency" && itemNames.length > 0) {
      const target = guessTargetItem(itemNames)
      config = JSON.stringify({
        ...DEFAULT_CONSISTENCY_CONFIG,
        target,
        viewpointItems: itemNames.filter((itemName) => itemName !== target),
      })
    }
    const input: GradeConstraintInput = {
      name:
        kind === "consistency"
          ? "評定と観点の整合"
          : kind === "mutual_exclusion"
            ? "A・C混在禁止"
            : "新しいルール",
      kind,
      config,
      expression: kind === "expression" ? 'has("A") and has("C")' : "",
      color: DEFAULT_CONSTRAINT_COLOR,
      message: null,
      enabled: true,
      order: constraints.length,
    }
    await createConstraint(input)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">観点間の制約ルール</h3>
        <p className="text-muted-foreground text-sm">
          観点別評価と評定の組合せが校内ルールに合わない生徒を、結果表で着色して知らせます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAdd("consistency")}
        >
          ＋ 整合ルール
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAdd("mutual_exclusion")}
        >
          ＋ 混在禁止
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => handleAdd("expression")}
        >
          ＋ 上級: 式
        </Button>
      </div>

      {constraints.length === 0 && (
        <p className="text-muted-foreground text-sm italic">
          ルールはまだありません。
        </p>
      )}

      <div className="space-y-3">
        {constraints.map((constraint) => (
          <ConstraintCard
            key={constraint.id}
            constraint={constraint}
            labels={labels}
            itemNames={itemNames}
            hitCount={evaluation?.counts.get(constraint.id) ?? 0}
            errorMessage={evaluation?.errors.get(constraint.id) ?? null}
            onUpdate={(patch) => updateConstraint(constraint.id, patch)}
            onDelete={() => deleteConstraint(constraint.id)}
          />
        ))}
      </div>
    </div>
  )
}

interface ConstraintCardProps {
  constraint: GradeConstraintData
  labels: string[]
  itemNames: string[]
  hitCount: number
  errorMessage: string | null
  onUpdate: (patch: Partial<GradeConstraintInput>) => void
  onDelete: () => void
}

function ConstraintCard({
  constraint,
  labels,
  itemNames,
  hitCount,
  errorMessage,
  onUpdate,
  onDelete,
}: ConstraintCardProps) {
  const [name, setName] = useState(constraint.name)
  const [expression, setExpression] = useState(constraint.expression)
  const [message, setMessage] = useState(constraint.message ?? "")

  useEffect(() => setName(constraint.name), [constraint.name])
  useEffect(() => setExpression(constraint.expression), [constraint.expression])
  useEffect(() => setMessage(constraint.message ?? ""), [constraint.message])

  const exprError =
    constraint.kind === "expression"
      ? validateConstraintExpression(expression)
      : null

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center gap-2">
        <div
          className="h-5 w-5 shrink-0 rounded border"
          style={{ backgroundColor: constraint.color }}
        />
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name !== constraint.name && onUpdate({ name })}
          className="h-8 flex-1"
          placeholder="ルール名"
        />
        <Badge variant="secondary" className="shrink-0">
          {KIND_LABELS[constraint.kind]}
        </Badge>
        <input
          type="color"
          value={constraint.color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          className="h-8 w-8 cursor-pointer rounded border"
          aria-label="着色色"
        />
        <Switch
          checked={constraint.enabled}
          onCheckedChange={(checked) => onUpdate({ enabled: checked })}
          aria-label="有効"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onDelete}
          aria-label="削除"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {constraint.kind === "consistency" && (
        <ConsistencyFields
          config={parseConsistency(constraint.config)}
          labels={labels}
          itemNames={itemNames}
          onChange={(config) => onUpdate({ config: JSON.stringify(config) })}
        />
      )}

      {constraint.kind === "mutual_exclusion" && (
        <MutualExclusionFields
          config={parseMutualExclusion(constraint.config)}
          labels={labels}
          onChange={(config) => onUpdate({ config: JSON.stringify(config) })}
        />
      )}

      {constraint.kind === "expression" && (
        <div className="space-y-1">
          <Textarea
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onBlur={() =>
              expression !== constraint.expression && onUpdate({ expression })
            }
            className="font-mono text-xs"
            rows={2}
            placeholder='has("A") and has("C")'
          />
          {exprError && (
            <p className="text-destructive text-xs">式エラー: {exprError}</p>
          )}
          <pre className="text-muted-foreground bg-muted/50 overflow-x-auto rounded p-2 text-[11px] leading-relaxed">
            {EXPRESSION_HELP}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground shrink-0 text-xs">
          メッセージ
        </Label>
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() =>
            (message || null) !== constraint.message &&
            onUpdate({ message: message || null })
          }
          className="h-8"
          placeholder="違反時にホバーで表示される説明（任意）"
        />
      </div>

      <div className="text-muted-foreground text-xs">
        {errorMessage ? (
          <span className="text-destructive">評価エラー: {errorMessage}</span>
        ) : (
          <>
            該当:{" "}
            <span className="text-foreground font-medium">{hitCount}</span> 名
          </>
        )}
      </div>
    </Card>
  )
}
