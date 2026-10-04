"use client"

import { createContext, useContext } from "react"

// ============================================================================
// 見出しフォーカス（スクロール位置で現在地を示す）
// ============================================================================

/** 現在スクロール位置にある（フォーカス中の）見出しタイトルを配る */
export const HeadingFocusContext = createContext<string | null>(null)

/** この見出しがフォーカス中かどうか（タイトルで識別） */
export function useHeadingActive(title: string): boolean {
  return useContext(HeadingFocusContext) === title
}

/**
 * フォーカス中のセクション背景。本文の流れには載せず、後ろに敷く全幅レイヤー。
 * left:calc(50%-50vw)+w-screen でセクション中央を基準にモーダル全幅へ広げ、
 * スクロール領域の overflow-x-hidden で左右がモーダル幅に切り取られる。
 * 角丸なしの自然なバンドになり、本文位置はずれない。
 */
function FocusBackground({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 left-[calc(50%-50vw)] -z-10 w-screen transition-colors duration-500 ${
        active ? "bg-blue-100/40" : "bg-transparent"
      }`}
    />
  )
}

/** フォーカス中に左から右へ青く伸びる下線（見出しの border-b に重ねる） */
function FocusUnderline({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="absolute -bottom-px left-0 h-0.5 w-full origin-left bg-blue-500 transition-transform duration-500 ease-out"
      style={{ transform: active ? "scaleX(1)" : "scaleX(0)" }}
    />
  )
}

/**
 * ドキュメント風の節。DocComponents の HelpSection と同じ見た目だが、
 * スクロール位置に応じて下線が青く伸びてフォーカスを示す。
 */
export function FocusSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const active = useHeadingActive(title)
  return (
    <section data-help-heading={title} className="relative isolate py-8">
      <FocusBackground active={active} />
      <h2 className="relative mb-5 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-900 md:text-3xl">
        {title}
        <FocusUnderline active={active} />
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  )
}

/** デモの見出し＋説明。スクロール位置で下線が青く伸びてフォーカスを示す */
export function DemoSection({
  title,
  instruction,
  children,
}: {
  title: string
  instruction: React.ReactNode
  children: React.ReactNode
}) {
  const active = useHeadingActive(title)
  return (
    <section data-help-heading={title} className="relative isolate py-8">
      <FocusBackground active={active} />
      <h2 className="relative mb-4 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-900 md:text-3xl">
        {title}
        <FocusUnderline active={active} />
      </h2>
      <p className="mb-4 text-[15px] leading-relaxed text-gray-700">
        {instruction}
      </p>
      {children}
    </section>
  )
}
