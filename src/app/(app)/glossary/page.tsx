"use client"

import { Search } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import PageHeader from "@/components/layout/PageHeader"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"

import { GlossaryIndex } from "./GlossaryIndex"
import { glossaryTermAnchorId, GlossaryTermEntry } from "./GlossaryTermEntry"
import {
  codeRefName,
  GLOSSARY_TERMS,
  type GlossaryTermId,
} from "./glossaryTerms"
import { GLOSSARY_TEXT_JA } from "./text/ja/glossaryTextJa"
import {
  GLOSSARY_GROUPS,
  type GlossarySection,
  type GlossaryTerm,
  type GlossaryText,
} from "./types"
import { useActiveGlossaryTerm } from "./useActiveGlossaryTerm"

/** 呼び名・別の表記・使わない語・説明・表や列の名前のどれかに含まれれば当てはまる */
function matchesGlossaryQuery(
  glossaryTerm: GlossaryTerm,
  glossaryText: GlossaryText,
  normalizedQuery: string
): boolean {
  const termText = glossaryText.terms[glossaryTerm.id]
  return [
    termText.label,
    termText.summary,
    ...termText.variants,
    ...termText.avoidedAliases,
    ...glossaryTerm.codeRefs.map(codeRefName),
  ].some((searchableText) =>
    searchableText.toLowerCase().includes(normalizedQuery)
  )
}

/**
 * 用語集。画面の語と、それが指す表・列・値・コードの識別子の対応（#1465）。
 *
 * 左に索引、右に本文。`/` で絞り込みの欄へ移る（キーボード操作を先に考える）。
 *
 * 文言は今は日本語だけ。言語を切り替えられるようになったら、ここで選ぶ文言
 * （`GLOSSARY_TEXT_JA`）を言語に応じて差し替える。
 */
export default function GlossaryPage() {
  const glossaryText = GLOSSARY_TEXT_JA
  const [query, setQuery] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const normalizedQuery = query.trim().toLowerCase()
  const matchedTerms = GLOSSARY_TERMS.filter((glossaryTerm) =>
    matchesGlossaryQuery(glossaryTerm, glossaryText, normalizedQuery)
  )
  const glossarySections: GlossarySection[] = GLOSSARY_GROUPS.map(
    (glossaryGroup) => ({
      groupId: glossaryGroup.id,
      hasSubgroups: glossaryGroup.categoryIds.length > 1,
      categories: glossaryGroup.categoryIds
        .map((categoryId) => ({
          categoryId,
          terms: matchedTerms.filter(
            (glossaryTerm) => glossaryTerm.categoryId === categoryId
          ),
        }))
        .filter(({ terms }) => terms.length > 0),
    })
  ).filter(({ categories }) => categories.length > 0)

  const activeTermId = useActiveGlossaryTerm(
    scrollContainerRef,
    matchedTerms.map((glossaryTerm) => glossaryTerm.id).join(",")
  )

  // 「/」で絞り込みの欄へ。入力中の欄では効かせない
  useEffect(() => {
    const focusSearchOnSlash = (event: KeyboardEvent) => {
      if (event.key !== "/") return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA")
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener("keydown", focusSearchOnSlash)
    return () => window.removeEventListener("keydown", focusSearchOnSlash)
  }, [])

  const jumpToTerm = (termId: GlossaryTermId) => {
    // 絞り込みで隠れている語へ飛ぶときは、絞り込みを外してから
    if (!matchedTerms.some((glossaryTerm) => glossaryTerm.id === termId)) {
      setQuery("")
    }
    requestAnimationFrame(() => {
      document
        .getElementById(glossaryTermAnchorId(termId))
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    })
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={glossaryText.ui.title}
        subtitle={glossaryText.ui.subtitle}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r bg-muted/30 lg:block">
          <GlossaryIndex
            glossarySections={glossarySections}
            glossaryText={glossaryText}
            activeTermId={activeTermId}
            onJumpToTerm={jumpToTerm}
          />
        </aside>
        <div
          ref={scrollContainerRef}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-8 py-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setQuery("")
                  }}
                  placeholder={glossaryText.ui.searchPlaceholder}
                  className="pr-10 pl-8"
                />
                <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">
                  /
                </Kbd>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {glossaryText.ui.termCount(matchedTerms.length)}
              </span>
            </div>
          </div>
          <div className="mx-auto max-w-3xl px-8 pb-24">
            {matchedTerms.length === 0 && (
              <p className="py-16 text-center text-sm text-muted-foreground">
                {glossaryText.ui.noMatch}
              </p>
            )}
            {glossarySections.map(({ groupId, hasSubgroups, categories }) => (
              <section key={groupId} className="pt-10">
                <h2 className="border-b-2 border-foreground pb-1.5 text-sm font-semibold tracking-wide">
                  {glossaryText.groups[groupId]}
                </h2>
                {categories.map(({ categoryId, terms }) => (
                  <div key={categoryId}>
                    {hasSubgroups && (
                      <h3 className="mt-6 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                        <span className="h-px w-3 bg-muted-foreground/50" />
                        {glossaryText.categories[categoryId]}
                        <span className="h-px flex-1 bg-border" />
                      </h3>
                    )}
                    {terms.map((glossaryTerm) => (
                      <GlossaryTermEntry
                        key={glossaryTerm.id}
                        glossaryTerm={glossaryTerm}
                        glossaryText={glossaryText}
                        normalizedQuery={normalizedQuery}
                        onJumpToTerm={jumpToTerm}
                      />
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
