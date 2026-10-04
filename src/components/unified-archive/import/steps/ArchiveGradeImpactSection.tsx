"use client"

import { AlertTriangle, CheckCircle2, Lock } from "lucide-react"

import {
  archiveGradeItemImpactBadge,
  archiveGradeWideChanges,
  buildArchiveGradeImpactMessage,
} from "../archiveGradeImpactMessages"
import type { ArchiveGradeImpact } from "../types"

/**
 * 確認の段の「この取り込みで値が変わる成績算出」。成績算出ごとに、値が変わりそうな評価項目と、
 * 名簿・設定の変化を並べる。確定済みの評価項目は印を付け、注意を強い色で添える
 */
export function ArchiveGradeImpactSection({
  impacts,
}: {
  impacts: readonly ArchiveGradeImpact[]
}) {
  const message = buildArchiveGradeImpactMessage(impacts)

  if (impacts.length === 0) {
    return (
      <section
        aria-label="成績算出への影響"
        className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground"
      >
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {message.lead}
      </section>
    )
  }

  return (
    <section
      aria-label="成績算出への影響"
      className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20"
    >
      <h4 className="flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        この取り込みで値が変わる成績算出
      </h4>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        {message.lead}
      </p>
      <ul className="max-h-60 scroll-fade space-y-2 overflow-y-auto">
        {impacts.map((impact) => (
          <li
            key={impact.grade.id}
            className="rounded-md border border-amber-200 bg-background px-3 py-2 dark:border-amber-900"
          >
            <p className="text-sm font-medium">{impact.grade.name}</p>
            {impact.items.length > 0 && (
              <ul className="mt-1 flex flex-wrap gap-1.5">
                {impact.items.map((item) => {
                  const badge = archiveGradeItemImpactBadge(item)
                  return (
                    <li
                      key={item.gradeItem.id}
                      className={
                        badge
                          ? "flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                          : "rounded bg-muted px-1.5 py-0.5 text-xs"
                      }
                    >
                      {badge && <Lock className="h-3 w-3" />}
                      {item.gradeItem.name}
                      {badge && <span>（{badge}）</span>}
                    </li>
                  )
                })}
              </ul>
            )}
            {archiveGradeWideChanges(impact).map((line) => (
              <p key={line} className="mt-1 text-xs text-muted-foreground">
                {line}
              </p>
            ))}
          </li>
        ))}
      </ul>
      {message.frozenNote && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          {message.frozenNote}
        </p>
      )}
    </section>
  )
}
