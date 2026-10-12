import { useEffect, useRef } from "react"

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
  const navRef = useRef<HTMLElement>(null)

  // 読み進めても今の語が索引の外へ出ないよう、索引の側も送る（本文は動かさない）
  useEffect(() => {
    if (activeTermId === null) return
    navRef.current
      ?.querySelector(`[data-index-term-id="${activeTermId}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [activeTermId])

  return (
    <nav
      ref={navRef}
      aria-label={glossaryText.ui.index}
      className="space-y-6 py-6 pr-3 pl-5 text-[13px]"
    >
      {glossarySections.map(({ groupId, hasSubgroups, categories }) => (
        <div key={groupId}>
          <div className="mb-1.5 flex items-baseline justify-between px-2 text-xs font-semibold tracking-wide text-foreground">
            <span>{glossaryText.groups[groupId]}</span>
            <span className="font-normal text-muted-foreground tabular-nums">
              {categories.reduce((acc, { terms }) => acc + terms.length, 0)}
            </span>
          </div>
          {categories.map(({ categoryId, terms }) => (
            <div key={categoryId} className={cn(hasSubgroups && "mt-2")}>
              {hasSubgroups && (
                <div className="px-2 pb-1 text-[11px] tracking-wider text-muted-foreground">
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
    <ul className={cn("space-y-px", isNested && "ml-2.5 border-l pl-1.5")}>
      {terms.map((glossaryTerm) => (
        <li key={glossaryTerm.id}>
          <button
            type="button"
            data-index-term-id={glossaryTerm.id}
            onClick={() => onJumpToTerm(glossaryTerm.id)}
            aria-current={
              activeTermId === glossaryTerm.id ? "location" : undefined
            }
            className={cn(
              "relative w-full truncate rounded-md px-2 py-1 text-left text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              activeTermId === glossaryTerm.id &&
                "bg-background font-medium text-foreground shadow-xs ring-1 ring-border/70"
            )}
          >
            {glossaryText.terms[glossaryTerm.id].label}
          </button>
        </li>
      ))}
    </ul>
  )
}
