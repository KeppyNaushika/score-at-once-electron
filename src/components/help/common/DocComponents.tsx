"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

/**
 * 初心者向けヘルプ（使い方ガイド）のドキュメント風プリミティブ。
 * 一般的なWebヘルプページのように、読みやすい1カラムで構成する。
 */

// ============================================================================
// 見出しフォーカス（スクロール位置で現在地を示す）
//
// HelpDoc でページ全体を包み、各節を FocusSection で書くと、スクロール位置に
// ある節の見出しに青い下線が伸び、背景が淡く色づいて「いま読んでいる場所」を
// 示す。HelpContent07Scoring と同じ挙動を全ページで共有するための実装。
// ============================================================================

/** 現在スクロール位置にある（フォーカス中の）見出しタイトルを配る */
const HeadingFocusContext = createContext<string | null>(null)

/** この見出しがフォーカス中かどうか（タイトルで識別） */
function useHeadingActive(title: string): boolean {
  return useContext(HeadingFocusContext) === title
}

/** スクロール可能な最寄りの祖先を返す（現在地判定の基準） */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let parent = el?.parentElement ?? null
  while (parent) {
    const overflowY = getComputedStyle(parent).overflowY
    if (overflowY === "auto" || overflowY === "scroll") return parent
    parent = parent.parentElement
  }
  return null
}

/**
 * フォーカス中のセクション背景。本文の流れには載せず、後ろに敷く全幅レイヤー。
 * left:calc(50%-50vw)+w-screen でセクション中央を基準にモーダル全幅へ広げ、
 * スクロール領域の overflow-x-hidden で左右がモーダル幅に切り取られる。
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
 * ページ全体のラッパー。スクロール位置を監視し、フォーカス中の見出しを配る。
 * 各ヘルプページは <HelpDoc> の中に HelpHero と FocusSection を並べる。
 */
export function HelpDoc({ children }: { children: React.ReactNode }) {
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
  }, [])

  return (
    <HeadingFocusContext.Provider value={activeTitle}>
      <div ref={rootRef}>{children}</div>
    </HeadingFocusContext.Provider>
  )
}

/**
 * ドキュメント風の節。HelpSection と同じ見た目だが、スクロール位置に応じて
 * 下線が青く伸びてフォーカスを示す。HelpDoc の中で使う。
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

/** 記事ヘッダー：ステップ番号チップ＋大見出し＋リード文 */
export function HelpHero({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: string
  title: string
  lead: string
}) {
  return (
    <header className="mb-10">
      {eyebrow && (
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
          {eyebrow}
        </span>
      )}
      <h1 className="text-3xl leading-tight font-bold text-gray-900 md:text-4xl">
        {title}
      </h1>
      <p className="mt-4 text-base leading-relaxed text-gray-600 md:text-lg">
        {lead}
      </p>
    </header>
  )
}

/** 節：h2＋下線。中身は読みやすい本文サイズに統一 */
export function HelpSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="first:mt-0">
      <h2 className="mb-5 border-b border-gray-200 pb-3 text-2xl font-bold text-gray-900 md:text-3xl">
        {title}
      </h2>
      <div className="space-y-4 text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </section>
  )
}

/** 図版コンテナ：CSS図解を中央に置き、下にキャプションを添える */
export function Figure({
  caption,
  children,
}: {
  caption?: string
  children: React.ReactNode
}) {
  return (
    <figure className="my-6">
      <div className="flex flex-col items-center gap-5 rounded-xl border border-gray-200 bg-gradient-to-b from-gray-50 to-white px-6 py-8">
        {children}
      </div>
      {caption && (
        <figcaption className="mt-2 text-center text-sm text-gray-500">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

type CalloutType = "tip" | "note" | "warning" | "success"

const calloutStyles: Record<
  CalloutType,
  { box: string; title: string; body: string; label: string }
> = {
  tip: {
    box: "border-blue-500 bg-blue-50",
    title: "text-blue-800",
    body: "text-blue-900/80",
    label: "ポイント",
  },
  success: {
    box: "border-emerald-500 bg-emerald-50",
    title: "text-emerald-800",
    body: "text-emerald-900/80",
    label: "できること",
  },
  warning: {
    box: "border-amber-500 bg-amber-50",
    title: "text-amber-800",
    body: "text-amber-900/80",
    label: "注意",
  },
  note: {
    box: "border-gray-300 bg-gray-50",
    title: "text-gray-800",
    body: "text-gray-600",
    label: "メモ",
  },
}

/** 左ボーダー付きの注記ボックス（ポイント／注意／できること など） */
export function Callout({
  type = "note",
  title,
  children,
}: {
  type?: CalloutType
  title?: string
  children: React.ReactNode
}) {
  const style = calloutStyles[type]
  return (
    <div className={`rounded-r-lg border-l-4 p-4 ${style.box}`}>
      <div className={`mb-1 text-sm font-bold ${style.title}`}>
        {title ?? style.label}
      </div>
      <div className={`text-sm leading-relaxed ${style.body}`}>{children}</div>
    </div>
  )
}

/** 手順リスト（番号付き） */
export function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-5">{children}</ol>
}

export function Step({
  n,
  title,
  children,
}: {
  n: number
  title: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
        {n}
      </span>
      <div className="flex-1 pt-0.5">
        <p className="font-semibold text-gray-900">{title}</p>
        {children && (
          <p className="mt-1 text-sm leading-relaxed text-gray-600">
            {children}
          </p>
        )}
      </div>
    </li>
  )
}

/**
 * 「どちらか一方だけ知りたい」選択肢を切り替えるタブ。
 * 選択肢が一目で分かるよう、大きめのセグメント表示にする。
 */
export function HelpTabs({
  tabs,
}: {
  tabs: {
    id: string
    label: string
    icon?: React.ReactNode
    content: React.ReactNode
  }[]
}) {
  const [active, setActive] = useState(tabs[0]?.id)
  const current = tabs.find((tab) => tab.id === active) ?? tabs[0]
  return (
    <div>
      <div
        role="tablist"
        className="inline-flex w-full gap-1 rounded-xl border border-gray-200 bg-gray-100 p-1 sm:w-auto"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors sm:flex-none ${
                isActive
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>
      <div className="mt-6 space-y-4">{current?.content}</div>
    </div>
  )
}

type KeyTone = "slate" | "green" | "red" | "amber" | "blue" | "violet"

const keyTones: Record<KeyTone, string> = {
  slate: "border-gray-300 from-gray-50 to-gray-100 text-gray-700",
  green: "border-emerald-300 from-emerald-50 to-emerald-100 text-emerald-700",
  red: "border-rose-300 from-rose-50 to-rose-100 text-rose-700",
  amber: "border-amber-300 from-amber-50 to-amber-100 text-amber-700",
  blue: "border-blue-300 from-blue-50 to-blue-100 text-blue-700",
  violet: "border-violet-300 from-violet-50 to-violet-100 text-violet-700",
}

/** 物理キー風の見た目（インライン） */
export function Kbd({
  children,
  tone = "slate",
}: {
  children: React.ReactNode
  tone?: KeyTone
}) {
  return (
    <kbd
      className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-b-2 bg-gradient-to-b px-2 font-mono text-sm font-bold ${keyTones[tone]}`}
    >
      {children}
    </kbd>
  )
}

/** キー図解用のタイル：大きなキー＋意味ラベル */
export function KeyTile({
  keyLabel,
  meaning,
  tone = "slate",
}: {
  keyLabel: string
  meaning: string
  tone?: KeyTone
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <kbd
        className={`flex h-12 w-12 items-center justify-center rounded-lg border border-b-2 bg-gradient-to-b text-lg font-bold shadow-sm ${keyTones[tone]}`}
      >
        {keyLabel}
      </kbd>
      <span className="text-xs font-medium text-gray-600">{meaning}</span>
    </div>
  )
}

/** キー＋説明の一覧（補助的なショートカット用） */
export function KeyList({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200">
      {children}
    </div>
  )
}

export function KeyRow({
  keys,
  tone = "slate",
  children,
}: {
  keys: string
  tone?: KeyTone
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="w-32 shrink-0">
        <Kbd tone={tone}>{keys}</Kbd>
      </span>
      <span className="text-sm text-gray-700">{children}</span>
    </div>
  )
}

/** ラベルのバッジ（種類の例などの一覧表示） */
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700">
      {children}
    </span>
  )
}
