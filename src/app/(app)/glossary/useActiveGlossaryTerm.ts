import { type RefObject, useEffect, useState } from "react"

import type { GlossaryTermId } from "./glossaryTerms"
import { isGlossaryTermId } from "./glossaryTerms"

/** 流れる枠の上端から、上に固定した絞り込みの欄の下あたりまでの距離 */
const READING_LINE_OFFSET = 112

/**
 * 本文で、いま読んでいる語を返す。索引の印に使う。
 *
 * **上端が読み始めの線（絞り込みの欄のすぐ下）を越えた語のうち、最後のもの**を採る。
 * 「見えている語のうち一番上」で決めると、前の語の下端が少し見えているだけでそちらを
 * 指してしまう。絞り込みで並ぶ語が変わったら測り直す（`termIdsKey`）。
 */
export function useActiveGlossaryTerm(
  scrollContainerRef: RefObject<HTMLElement | null>,
  termIdsKey: string
): GlossaryTermId | null {
  const [activeTermId, setActiveTermId] = useState<GlossaryTermId | null>(null)

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer === null) return

    let frame = 0
    const measure = () => {
      frame = 0
      const readingLine =
        scrollContainer.getBoundingClientRect().top + READING_LINE_OFFSET
      const termElements = Array.from(
        scrollContainer.querySelectorAll<HTMLElement>("[data-glossary-term-id]")
      )
      const passedElements = termElements.filter(
        (termElement) => termElement.getBoundingClientRect().top <= readingLine
      )
      const currentElement = passedElements.at(-1) ?? termElements.at(0)
      const termId = currentElement?.dataset.glossaryTermId
      if (termId !== undefined && isGlossaryTermId(termId)) {
        setActiveTermId(termId)
      }
    }
    const scheduleMeasure = () => {
      if (frame === 0) frame = requestAnimationFrame(measure)
    }

    measure()
    scrollContainer.addEventListener("scroll", scheduleMeasure, {
      passive: true,
    })
    return () => {
      scrollContainer.removeEventListener("scroll", scheduleMeasure)
      cancelAnimationFrame(frame)
    }
  }, [scrollContainerRef, termIdsKey])

  return activeTermId
}
