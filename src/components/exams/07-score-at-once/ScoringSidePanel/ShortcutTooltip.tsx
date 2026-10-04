"use client"

import type React from "react"

import { WithTooltip } from "@/components/common/WithTooltip"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

interface ShortcutTooltipProps {
  /** 何をするボタンか（1行目に太字で出す） */
  description: React.ReactNode
  /**
   * 割り当てたキー。1つなら1つのキー、複数なら「+」でつないだ同時押しとして出す。
   * 「Ctrl+A」のように1つのキーの枠に収めたい表記は1要素で渡す
   */
  keys: readonly string[]
  /** Tooltip を付ける要素（ref とイベントを受け取れる1要素） */
  children: React.ReactElement
  /** 出す向き（既定は上） */
  side?: React.ComponentProps<typeof WithTooltip>["side"]
}

/** 説明の下にショートカットキーを添えた Tooltip */
export function ShortcutTooltip({
  description,
  keys,
  children,
  side,
}: ShortcutTooltipProps) {
  return (
    <WithTooltip
      side={side}
      content={
        <div className="text-center">
          <div className="font-medium">{description}</div>
          <div className="mt-1 text-xs text-gray-400">
            キー:{" "}
            {keys.length === 1 ? (
              <Kbd>{keys[0]}</Kbd>
            ) : (
              <KbdGroup>
                {keys.map((key, i) => (
                  <ShortcutKey key={key} keyLabel={key} isFirst={i === 0} />
                ))}
              </KbdGroup>
            )}
          </div>
        </div>
      }
    >
      {children}
    </WithTooltip>
  )
}

/** 同時押しの1キー（2つめ以降は前に「+」を挟む） */
function ShortcutKey({
  keyLabel,
  isFirst,
}: {
  keyLabel: string
  isFirst: boolean
}) {
  return (
    <>
      {!isFirst && <span>+</span>}
      <Kbd>{keyLabel}</Kbd>
    </>
  )
}
