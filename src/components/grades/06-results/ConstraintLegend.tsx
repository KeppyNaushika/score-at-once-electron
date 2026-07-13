import type { GradeConstraintData } from "@/types/grade.types"

/** 制約ルールの色凡例 */
export function ConstraintLegend({
  constraints,
}: {
  constraints: GradeConstraintData[]
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
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
  )
}
