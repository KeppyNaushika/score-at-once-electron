import { AlertTriangle } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import type { GradeConstraintData } from "@/types/grade.types"

interface ConstraintLegendProps {
  constraints: GradeConstraintData[]
  /**
   * constraintId → 評価できなかった理由。
   * 評価できないルールは着色されないため、黙って「違反なし」に見えてしまう。
   * 境界設定画面を開かなくても気づけるよう、結果表でも警告する（issue #1063）。
   */
  errors: Map<string, string>
}

/** 制約ルールの色凡例と、評価できなかったルールの警告 */
export function ConstraintLegend({
  constraints,
  errors,
}: ConstraintLegendProps) {
  const brokenConstraints = constraints.filter((constraint) =>
    errors.has(constraint.id)
  )

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
        <span className="text-muted-foreground">制約ルール:</span>
        {constraints.map((constraint) => (
          <span key={constraint.id} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded border"
              style={{ backgroundColor: constraint.color }}
            />
            {constraint.name}
          </span>
        ))}
      </div>

      {brokenConstraints.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            評価できない制約ルールが{brokenConstraints.length}件あります
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
              {brokenConstraints.map((constraint) => (
                <li key={constraint.id}>
                  「{constraint.name}」: {errors.get(constraint.id)}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs">
              これらのルールは着色されていません。違反が無いのではなく、判定できていません。境界設定の「観点間の制約ルール」で設定を直してください。
            </p>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
