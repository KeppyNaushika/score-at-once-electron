"use client"

import { FocusHeadingSection } from "@/components/help/common/DocComponents"

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
  return (
    <FocusHeadingSection title={title} headingMarginClassName="mb-4">
      <p className="mb-4 text-[15px] leading-relaxed text-gray-700">
        {instruction}
      </p>
      {children}
    </FocusHeadingSection>
  )
}
