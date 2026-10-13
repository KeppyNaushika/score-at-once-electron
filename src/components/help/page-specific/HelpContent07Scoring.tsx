"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, useState } from "react"

import { HelpDoc, HelpHero } from "@/components/help/common/DocComponents"
import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { resolveKeyBindings } from "@/lib/scoringKeybindings"
import { keyboardShortcutsQuery } from "@/queries/settings"

import { GridGuide } from "./07-scoring/GridGuide"
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
import { formatKey } from "./07-scoring/utils"

// ============================================================================
// 本体
// ============================================================================

export function HelpContent07Scoring() {
  // ユーザーが設定したショートカット（既定＋上書きの解決済み）を反映する。
  // 「使い方」は段のヘッダー（layout）が開くので ShortcutProvider の外にある。
  // provider と同じ設定のキャッシュから直接読む
  const userId = useCurrentUser().id
  const { data: storedKeyBindings } = useQuery(keyboardShortcutsQuery(userId))
  const keyBindings = useMemo(
    () => resolveKeyBindings(storedKeyBindings),
    [storedKeyBindings]
  )
  const [style, setStyle] = useState<"grid" | "individual" | null>(null)

  const keys: GuideKeys = {
    correct: formatKey(keyBindings["scoring.correct"]),
    incorrect: formatKey(keyBindings["scoring.incorrect"]),
    partial: formatKey(keyBindings["scoring.partial"]),
    pending: formatKey(keyBindings["scoring.pending"]),
    nextQuestion: formatKey(keyBindings["navigation.nextQuestion"]),
    prevQuestion: formatKey(keyBindings["navigation.prevQuestion"]),
    filterCorrect: formatKey(keyBindings["filter.toggleCorrect"]),
    filterIncorrect: formatKey(keyBindings["filter.toggleIncorrect"]),
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

  return (
    <>
      <style>{HELP07_KEYFRAMES}</style>
      {/* スタイルを選ぶと見出しが入れ替わるので、選ぶたびに現在地を測り直す */}
      <HelpDoc headingSetKey={style}>
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
      </HelpDoc>
    </>
  )
}
