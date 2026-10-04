"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { useShortcutContext } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import { HelpHero } from "@/components/help/common/DocComponents"

import { GridGuide } from "./07-scoring/GridGuide"
import { HeadingFocusContext } from "./07-scoring/HeadingFocus"
import { IndividualGuide } from "./07-scoring/IndividualGuide"
import { HELP07_KEYFRAMES } from "./07-scoring/keyframes"
import { Scene } from "./07-scoring/Scene"
import { StyleChooser } from "./07-scoring/StyleChooser"
import type {
  DemoStatus,
  GuideKeys,
  NavKeys,
  ToolKeys,
} from "./07-scoring/types"
import { formatKey, formatModKey } from "./07-scoring/utils"

/** スクロール可能な最寄りの祖先を返す（IntersectionObserver の root 用） */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null
  while (parent) {
    const overflowY = getComputedStyle(parent).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return parent
    parent = parent.parentElement
  }
  return null
}

// ============================================================================
// 本体
// ============================================================================

export function HelpContent07Scoring() {
  // ユーザーが設定したショートカット（既定＋上書きの解決済み）を反映する
  const { keyBindings } = useShortcutContext()
  const [style, setStyle] = useState<"grid" | "individual" | null>(null)

  const keys: GuideKeys = {
    correct: formatKey(keyBindings["scoring.correct"]),
    incorrect: formatKey(keyBindings["scoring.incorrect"]),
    partial: formatKey(keyBindings["scoring.partial"]),
    pending: formatKey(keyBindings["scoring.pending"]),
    nextQuestion: formatKey(keyBindings["navigation.nextQuestion"]),
    prevQuestion: formatKey(keyBindings["navigation.prevQuestion"]),
    filterCorrect: formatModKey(keyBindings["filter.toggleCorrect"]),
    filterIncorrect: formatModKey(keyBindings["filter.toggleIncorrect"]),
    toggleView: formatKey(keyBindings["view.toggleViewMode"]),
    toggleMaster: formatKey(keyBindings["view.toggleMasterAnswer"]),
  }

  const toolKeys: ToolKeys = {
    line: formatKey(keyBindings["tool.line"]),
    rectangle: formatKey(keyBindings["tool.rectangle"]),
    ellipse: formatKey(keyBindings["tool.ellipse"]),
    text: formatKey(keyBindings["tool.text"]),
    select: formatKey(keyBindings["tool.select"]),
    hand: formatKey(keyBindings["tool.hand"]),
  }

  // デモ用に生のキー（設定値そのまま）を渡す。識別子の同一性を保つためメモ化。
  const rawCorrect = keyBindings["scoring.correct"]
  const rawIncorrect = keyBindings["scoring.incorrect"]
  const rawPartial = keyBindings["scoring.partial"]
  const rawPending = keyBindings["scoring.pending"]
  const rawNoAnswer = keyBindings["scoring.noAnswer"]
  const rawKeys = useMemo<Record<DemoStatus, string>>(
    () => ({
      unscored: "",
      correct: rawCorrect,
      incorrect: rawIncorrect,
      partial: rawPartial,
      no_answer: rawNoAnswer,
      pending: rawPending,
    }),
    [rawCorrect, rawIncorrect, rawPartial, rawNoAnswer, rawPending]
  )

  const navUp = keyBindings["navigation.moveUp"] || "w"
  const navLeft = keyBindings["navigation.moveLeft"] || "a"
  const navDown = keyBindings["navigation.moveDown"] || "s"
  const navRight = keyBindings["navigation.moveRight"] || "d"
  const navKeys = useMemo<NavKeys>(
    () => ({
      up: navUp.toLowerCase(),
      left: navLeft.toLowerCase(),
      down: navDown.toLowerCase(),
      right: navRight.toLowerCase(),
    }),
    [navUp, navLeft, navDown, navRight]
  )

  const guideRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (style) {
      guideRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }
  }, [style])

  // スクロール位置で「いまどの見出しを読んでいるか」を判定し、
  // その見出しの下線を青く伸ばしてフォーカスを示す（全見出し共通）。
  const rootRef = useRef<HTMLDivElement>(null)
  const [activeTitle, setActiveTitle] = useState<string | null>(null)
  useEffect(() => {
    const host = rootRef.current
    const root = getScrollParent(host)
    if (!host || !root) return
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const headings = Array.from(
          host.querySelectorAll<HTMLElement>("[data-help-heading]")
        )
        if (headings.length === 0) {
          setActiveTitle(null)
          return
        }
        const rootTop = root.getBoundingClientRect().top
        const line = root.clientHeight * 0.35
        let current = headings[0].dataset.helpHeading ?? null
        for (const heading of headings) {
          const top = heading.getBoundingClientRect().top - rootTop
          if (top - 8 <= line) current = heading.dataset.helpHeading ?? current
          else break
        }
        setActiveTitle(current)
      })
    }
    root.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      root.removeEventListener("scroll", update)
      cancelAnimationFrame(raf)
    }
  }, [style])

  return (
    <HeadingFocusContext.Provider value={activeTitle}>
      <style>{HELP07_KEYFRAMES}</style>
      <div ref={rootRef}>
        <Scene>
          <HelpHero
            eyebrow="ステップ 7 / 採点"
            title="答案を採点する"
            lead="やることは、赤ペンの○×と同じです。答案を見て、○か×かを決めていくだけです。まず、採点のスタイルを選んでください。"
          />
        </Scene>

        <StyleChooser selected={style} onSelect={setStyle} />

        {style && (
          <div ref={guideRef}>
            {style === "grid" ? (
              <GridGuide rawKeys={rawKeys} navKeys={navKeys} keys={keys} />
            ) : (
              <IndividualGuide
                toolKeys={toolKeys}
                keys={keys}
                rawKeys={rawKeys}
                navKeys={navKeys}
              />
            )}
          </div>
        )}
      </div>
    </HeadingFocusContext.Provider>
  )
}
