"use client"

import type { Ref } from "react"

import { Textarea } from "@/components/ui/textarea"

interface AiQuestioningAdviceFieldProps {
  textareaRef: Ref<HTMLTextAreaElement>
  value: string
  onChange: (text: string) => void
  /** 欄を抜けた（入力中の覚えを捨てるだけ。書くのは1打鍵ごと） */
  onLeave: () => void
}

/**
 * 問いのカードの助言（朱書き）の欄（docs/vlm-grading-design.md §3-5）。空なら朱書きしない。
 * 欄の中のキーは採点画面が取らない（Ctrl/⌘+Enter・Ctrl/⌘+Shift+Enter だけが効く）。変換中のキーは見ず、Esc で抜ける
 */
export function AiQuestioningAdviceField({
  textareaRef,
  value,
  onChange,
  onLeave,
}: AiQuestioningAdviceFieldProps) {
  return (
    <label className="block space-y-0.5">
      <span className="text-[10px] text-muted-foreground">助言（朱書き）</span>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onLeave}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return
          if (event.key === "Escape") event.currentTarget.blur()
        }}
        placeholder="なし（朱書きしない）"
        className="min-h-10 text-xs"
      />
    </label>
  )
}
