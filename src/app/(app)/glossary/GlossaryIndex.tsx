import { cn } from "@/lib/utils"

import type { GlossaryTermId } from "./glossaryTerms"
import type { GlossarySection, GlossaryTerm, GlossaryText } from "./types"

/**
 * 左の索引。大分類・小分類ごとに語を並べ、いま読んでいる語に印を付ける。押すとその語へ
 * 飛ぶ。絞り込み中は当てはまる語だけを出す（本文と同じものを並べる）。
 */
export function GlossaryIndex({
  glossarySections,
  glossaryText,
  activeTermId,
  onJumpToTerm,
}: {
  glossarySections: GlossarySection[]
  glossaryText: GlossaryText
  activeTermId: GlossaryTermId | null
  onJumpToTerm: (termId: GlossaryTermId) => void
}) {
  return (
    <nav
      aria-label={glossaryText.ui.index}
      className="space-y-5 py-4 pr-2 pl-4 text-sm"
    >
      {glossarySections.map(({ groupId, hasSubgroups, categories }) => (
        <div key={groupId}>
          <div className="mb-1 flex items-baseline justify-between px-2 text-xs font-semibold text-foreground">
            <span>{glossaryText.groups[groupId]}</span>
            <span className="font-normal text-muted-foreground tabular-nums">
              {categories.reduce((acc, { terms }) => acc + terms.length, 0)}
            </span>
          </div>
          {categories.map(({ categoryId, terms }) => (
            <div key={categoryId} className={cn(hasSubgroups && "mt-2")}>
              {hasSubgroups && (
                <div className="px-2 pb-0.5 text-[11px] text-muted-foreground">
                  {glossaryText.categories[categoryId]}
                </div>
              )}
              <GlossaryIndexTerms
                terms={terms}
                glossaryText={glossaryText}
                activeTermId={activeTermId}
                onJumpToTerm={onJumpToTerm}
                isNested={hasSubgroups}
              />
            </div>
          ))}
        </div>
      ))}
    </nav>
  )
}

function GlossaryIndexTerms({
  terms,
  glossaryText,
  activeTermId,
  onJumpToTerm,
  isNested,
}: {
  terms: GlossaryTerm[]
  glossaryText: GlossaryText
  activeTermId: GlossaryTermId | null
  onJumpToTerm: (termId: GlossaryTermId) => void
  isNested: boolean
}) {
  return (
    <ul className={cn("space-y-px", isNested && "ml-2 border-l pl-1")}>
      {terms.map((glossaryTerm) => (
        <li key={glossaryTerm.id}>
          <button
            type="button"
            onClick={() => onJumpToTerm(glossaryTerm.id)}
            aria-current={
              activeTermId === glossaryTerm.id ? "location" : undefined
            }
            className={cn(
              "w-full truncate rounded-md border-l-2 border-transparent px-2 py-1 text-left text-foreground/80 hover:bg-accent hover:text-foreground",
              activeTermId === glossaryTerm.id &&
                "border-foreground bg-accent font-medium text-foreground"
            )}
          >
            {glossaryText.terms[glossaryTerm.id].label}
          </button>
        </li>
      ))}
    </ul>
  )
}
