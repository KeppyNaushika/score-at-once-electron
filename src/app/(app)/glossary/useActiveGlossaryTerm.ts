import { type RefObject, useEffect, useState } from "react"

import type { GlossaryTermId } from "./glossaryTerms"
import { isGlossaryTermId } from "./glossaryTerms"

/**
 * 本文で、いま読んでいる語（流れる枠の上端に最も近い語）を返す。索引の印に使う。
 *
 * 枠の上から3割の帯に入っている語を見張り、そのうち最も上のものを採る。
 * 絞り込みで並ぶ語が変わったら見張り直す（`termIdsKey`）。
 */
export function useActiveGlossaryTerm(
  scrollContainerRef: RefObject<HTMLElement | null>,
  termIdsKey: string
): GlossaryTermId | null {
  const [activeTermId, setActiveTermId] = useState<GlossaryTermId | null>(null)

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer === null) return

    const visibleTermIds = new Set<string>()
    const termElements = Array.from(
      scrollContainer.querySelectorAll<HTMLElement>("[data-glossary-term-id]")
    )
    const observer = new IntersectionObserver(
      (observerEntries) => {
        observerEntries.forEach((observerEntry) => {
          const termId = observerEntry.target.getAttribute(
            "data-glossary-term-id"
          )
          if (termId === null) return
          if (observerEntry.isIntersecting) visibleTermIds.add(termId)
          else visibleTermIds.delete(termId)
        })
        // 並び順（文書の順）で最初に見えている語
        const topTermId = termElements
          .map((termElement) => termElement.dataset.glossaryTermId)
          .find((termId) => termId !== undefined && visibleTermIds.has(termId))
        if (topTermId !== undefined && isGlossaryTermId(topTermId)) {
          setActiveTermId(topTermId)
        }
      },
      { root: scrollContainer, rootMargin: "0px 0px -70% 0px" }
    )
    termElements.forEach((termElement) => observer.observe(termElement))
    return () => observer.disconnect()
  }, [scrollContainerRef, termIdsKey])

  return activeTermId
}
