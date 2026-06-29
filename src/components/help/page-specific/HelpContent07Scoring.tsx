"use client"

import { ArrowRight, Eye, RotateCcw } from "lucide-react"
import {
  createContext,
  type CSSProperties,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { getDynamicScoreStatusConfig } from "@/components/exams/07-score-at-once/ScoringGrid/constants/scoreStatusConfig"
import { useSelectionBorder } from "@/components/exams/07-score-at-once/ScoringGrid/hooks/useSelectionBorder"
import { useShortcutContext } from "@/components/exams/07-score-at-once/ScoringMain/contexts/ShortcutProvider"
import PartialScoreModal from "@/components/exams/07-score-at-once/ScoringMain/PartialScoreModal"
import { Callout, HelpHero, Kbd } from "@/components/help/common/DocComponents"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { getModifierKeyLabel } from "@/lib/platformUtils"
import { SCORING_STATUS_LABELS } from "@/lib/scoringStatusColors"

/** キー文字列を表示用に整形（"e"→"E", "Shift+d"→"Shift+D"） */
function formatKey(key?: string): string {
  if (!key) return ""
  return key
    .split("+")
    .map((part) => (part.length === 1 ? part.toUpperCase() : part))
    .join("+")
}

/** 修飾キーを実行環境のラベルに合わせて整形（"Alt+e"→ Mac: "Option+E"） */
function formatModKey(key?: string): string {
  return formatKey(key).replace(/Alt/gi, getModifierKeyLabel())
}

/** スクロール可能な最寄りの祖先を返す（IntersectionObserver の root 用） */
function getScrollParent(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null
  while (p) {
    const oy = getComputedStyle(p).overflowY
    if (oy === "auto" || oy === "scroll") return p
    p = p.parentElement
  }
  return null
}

const MAX_SCORE = 10

type DemoStatus =
  | "unscored"
  | "correct"
  | "incorrect"
  | "partial"
  | "no_answer"
  | "pending"

interface GuideKeys {
  correct: string
  incorrect: string
  partial: string
  pending: string
  nextQuestion: string
  prevQuestion: string
  filterCorrect: string
  filterIncorrect: string
  toggleView: string
  toggleMaster: string
}

// ============================================================================
// 見出しフォーカス（スクロール位置で現在地を示す）
// ============================================================================

/** 現在スクロール位置にある（フォーカス中の）見出しタイトルを配る */
const HeadingFocusContext = createContext<string | null>(null)

/** この見出しがフォーカス中かどうか（タイトルで識別） */
function useHeadingActive(title: string): boolean {
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
function FocusSection({
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

// ============================================================================
// 採点スタイルの説明アニメーション（CSS / SVG）
// ============================================================================

const HELP07_KEYFRAMES = `
@keyframes help07Sel {
  0%, 100% { border-color: #e5e7eb; }
  6% { border-color: var(--help07-sel, #F97316); }
  18% { border-color: #e5e7eb; }
}
@keyframes help07Mark {
  0%, 10% { opacity: 0; transform: scale(0.4); }
  20% { opacity: 1; transform: scale(1); }
  90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes help07Pen {
  0% { stroke-dashoffset: var(--help07-len); opacity: 1; }
  45%, 80% { stroke-dashoffset: 0; opacity: 1; }
  95% { stroke-dashoffset: 0; opacity: 0; }
  100% { stroke-dashoffset: var(--help07-len); opacity: 0; }
}
@keyframes help07March { to { stroke-dashoffset: -14; } }
@keyframes help07Pan {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(7px); }
}
/* 緑枠が設問を1つずつ下へ移る */
@keyframes help07FrameDown {
  0%, 22% { transform: translateY(0); }
  33%, 55% { transform: translateY(24px); }
  66%, 100% { transform: translateY(48px); }
}
/* 3つの要素を順番に1つずつ表示（生徒が次々と変わる） */
@keyframes help07Show3 {
  0% { opacity: 0; }
  3%, 30% { opacity: 1; }
  33%, 100% { opacity: 0; }
}
/* 模範解答が現れて消える（オーバーレイの説明図） */
@keyframes help07Master {
  0%, 12% { opacity: 0; }
  28%, 72% { opacity: 1; }
  88%, 100% { opacity: 0; }
}
/* 模範解答が右からスライドイン／アウト（左右分割の説明図） */
@keyframes help07MasterSlideH {
  0%, 12% { transform: translateX(100%); }
  28%, 72% { transform: translateX(0); }
  88%, 100% { transform: translateX(100%); }
}
/* 模範解答が下からスライドイン／アウト（上下分割の説明図） */
@keyframes help07MasterSlideV {
  0%, 12% { transform: translateY(100%); }
  28%, 72% { transform: translateY(0); }
  88%, 100% { transform: translateY(100%); }
}
/* 答案用紙の中央が左半分の中央へ寄る（左右分割の説明図） */
@keyframes help07SheetH {
  0%, 12% { transform: translateX(0); }
  28%, 72% { transform: translateX(-25%); }
  88%, 100% { transform: translateX(0); }
}
/* 答案用紙の中央が上半分の中央へ寄る（上下分割の説明図） */
@keyframes help07SheetV {
  0%, 12% { transform: translateY(0); }
  28%, 72% { transform: translateY(-25%); }
  88%, 100% { transform: translateY(0); }
}
`

/** 一覧表示の説明アニメ：答案が並び、順に印がついていく */
function GridStyleAnimation() {
  const colors = useScoringStatusColors()
  const sel = useSelectionBorder()
  const marks = [true, false, true, true, false, true]
  return (
    <div
      className="grid grid-cols-3 gap-1.5"
      style={{ "--help07-sel": sel } as CSSProperties}
    >
      {marks.map((ok, i) => (
        <div
          key={i}
          className="flex h-9 items-center justify-center rounded-sm border-2 bg-white"
          style={{ animation: `help07Sel 6s ${i * 0.7}s infinite` }}
        >
          <span
            className="text-lg font-bold"
            style={{
              color: ok ? colors.correct.icon : colors.incorrect.icon,
              opacity: 0,
              animation: `help07Mark 6s ${i * 0.7}s infinite`,
            }}
          >
            {ok ? "○" : "×"}
          </span>
        </div>
      ))}
    </div>
  )
}

/** 個別表示の説明アニメ：1枚の答案に赤ペンで丸をつける */
function IndividualStyleAnimation() {
  const colors = useScoringStatusColors()
  const red = colors.incorrect.icon
  const len = 2 * Math.PI * 15
  return (
    <svg viewBox="0 0 140 84" className="h-20 w-full">
      <rect
        x="6"
        y="6"
        width="128"
        height="72"
        rx="5"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="2"
      />
      <line
        x1="18"
        y1="28"
        x2="74"
        y2="28"
        stroke="#d1d5db"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="44"
        x2="90"
        y2="44"
        stroke="#d1d5db"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="18"
        y1="60"
        x2="62"
        y2="60"
        stroke="#d1d5db"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle
        cx="104"
        cy="44"
        r="15"
        fill="none"
        stroke={red}
        strokeWidth="3"
        strokeLinecap="round"
        style={
          {
            strokeDasharray: len,
            "--help07-len": len,
            animation: "help07Pen 4s infinite",
          } as CSSProperties
        }
      />
    </svg>
  )
}

function StyleCard({
  title,
  desc,
  animation,
  active,
  onClick,
}: {
  title: string
  desc: string
  animation: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col gap-3 rounded-xl border p-5 text-left transition-colors ${
        active
          ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-200"
          : "border-gray-200 bg-white hover:border-blue-400 hover:bg-blue-50/40"
      }`}
    >
      <div className="flex h-24 items-center justify-center rounded-lg bg-gray-50 p-3">
        {animation}
      </div>
      <div>
        <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">{desc}</p>
      </div>
      <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-blue-600">
        {active ? "選択中（下に手順があります）" : "この表示で進む"}
        {!active && (
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        )}
      </span>
    </button>
  )
}

function StyleChooser({
  selected,
  onSelect,
}: {
  selected: "grid" | "individual" | null
  onSelect: (style: "grid" | "individual") => void
}) {
  return (
    <Scene>
      <FocusSection title="① 採点スタイルを選ぶ">
        <p>
          採点画面には2つの表示があります。選ぶと、下に詳しい手順が表示されます。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <StyleCard
            title="一覧表示"
            desc="同じ設問の答案を全員ぶん並べて表示し、次々と採点します。同じ問題をまとめて見られます。"
            animation={<GridStyleAnimation />}
            active={selected === "grid"}
            onClick={() => onSelect("grid")}
          />
          <StyleCard
            title="個別表示"
            desc="1人ぶんの答案を大きく表示し、じっくり採点します。答案に直接、記号やコメントを書き込めます。"
            animation={<IndividualStyleAnimation />}
            active={selected === "individual"}
            onClick={() => onSelect("individual")}
          />
        </div>
      </FocusSection>
    </Scene>
  )
}

// ============================================================================
// 一覧表示の体験デモ（段階的）
// ============================================================================

interface DemoCell {
  name: string
  answer: string
  status: DemoStatus
  score?: number
}

/** ②選択の練習用（全員未採点・選択のみ） */
const SELECT_CELLS: DemoCell[] = [
  { name: "佐藤", answer: "12", status: "unscored" },
  { name: "鈴木", answer: "13", status: "unscored" },
  { name: "高橋", answer: "12", status: "unscored" },
  { name: "田中", answer: "12", status: "unscored" },
  { name: "伊藤", answer: "13", status: "unscored" },
  { name: "渡辺", answer: "12", status: "unscored" },
]

/** ③採点（正答・誤答だけ） */
const STAGE1_CELLS: DemoCell[] = [
  { name: "佐藤", answer: "12", status: "unscored" },
  { name: "鈴木", answer: "13", status: "unscored" },
  { name: "高橋", answer: "12", status: "unscored" },
  { name: "田中", answer: "13", status: "unscored" },
]

/** ステップ2：1人だけ未採点（部分点の対象）、ほかは採点済み。
    設問「1辺3cmの正方形の面積」。田中は単位を書き忘れて部分点。 */
const STAGE2_CELLS: DemoCell[] = [
  { name: "佐藤", answer: "9cm²", status: "correct" },
  { name: "鈴木", answer: "6cm²", status: "incorrect" },
  { name: "高橋", answer: "（空欄）", status: "no_answer" },
  { name: "田中", answer: "9", status: "unscored" },
  { name: "伊藤", answer: "9cm²", status: "correct" },
]

function scoreText(cell: DemoCell): string | null {
  switch (cell.status) {
    case "correct":
      return `${MAX_SCORE}/${MAX_SCORE}`
    case "incorrect":
    case "no_answer":
      return `0/${MAX_SCORE}`
    case "partial":
      return `${cell.score ?? 0}/${MAX_SCORE}`
    case "pending":
      return `-/${MAX_SCORE}`
    default:
      return null
  }
}

interface PartialInput {
  active: boolean
  value: string
}

/**
 * 採点グリッドの体験デモ。本体の色設定・枠色・ステータス設定・UIコンポーネントを
 * 再利用し、本番と同じ見た目で、クリックまたはキーボードで採点を試せる。
 *
 * キーボードは、このデモが表示されている間（＝ヘルプを開いている間）つねに
 * window のキャプチャ段階で横取りし、stopImmediatePropagation で本体のショート
 * カット（document のキャプチャリスナ）に届かせない。ヘルプを閉じるとアンマウント
 * されてリスナも外れるため、本番のキー操作には影響しない。
 */
interface NavKeys {
  up: string
  left: string
  down: string
  right: string
}

/** デモ各セルの幅（模範解答・生徒答案で共通） */
const DEMO_CELL_W = "w-36"

/** ショートカットキー表示（本番 ScoringToolbar の KeyHint と同一） */
function KeyHint({ label }: { label: string }) {
  return (
    <div className="mt-1 text-xs text-gray-400">
      キー:{" "}
      <kbd className="rounded bg-gray-200 px-1 py-0.5 text-xs">{label}</kbd>
    </div>
  )
}

/**
 * 採点ボタン列。本番 ScoringToolbar と完全に同一（ツールチップ含む。下表示）。
 * 一覧表示・個別表示どちらのデモでも使う。
 */
function ScoringButtonRow({
  markOrder,
  rawKeys,
  onScore,
}: {
  markOrder: DemoStatus[]
  rawKeys: Record<DemoStatus, string>
  onScore: (status: DemoStatus) => void
}) {
  const colors = useScoringStatusColors()
  const cfg = getDynamicScoreStatusConfig(colors)
  if (markOrder.length === 0) return null
  return (
    <TooltipProvider delayDuration={300}>
      <div className="mt-4 flex flex-wrap gap-2">
        {markOrder.map((status) => {
          const sc = colors[status]
          const Icon = cfg[status].icon
          const keyLabel = (rawKeys[status] || "?").toUpperCase()
          return (
            <Tooltip key={status}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onScore(status)}
                  className="flex h-12 w-16 flex-col gap-1 border-2 hover:opacity-80"
                  style={{
                    backgroundColor: sc.bg,
                    color: sc.text,
                    borderColor: sc.bg,
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <div className="text-xs">{SCORING_STATUS_LABELS[status]}</div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <div className="text-center">
                  <div className="font-medium">
                    {SCORING_STATUS_LABELS[status]}にする
                  </div>
                  <KeyHint label={keyLabel} />
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function ScoringGridDemo({
  initialCells,
  markOrder,
  allowPartial,
  rawKeys,
  navKeys,
  questionExample,
  masterAnswer,
  isActive,
  completion,
  onAllScored,
}: {
  initialCells: DemoCell[]
  markOrder: DemoStatus[]
  allowPartial: boolean
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  questionExample: string
  masterAnswer: string
  isActive: boolean
  completion?: React.ReactNode
  onAllScored?: () => void
}) {
  const colors = useScoringStatusColors()
  const selectionColor = useSelectionBorder()
  const cfg = getDynamicScoreStatusConfig(colors)
  const firstUnscored = Math.max(
    0,
    initialCells.findIndex((c) => c.status === "unscored")
  )
  const [cells, setCells] = useState<DemoCell[]>(initialCells)
  const [selected, setSelected] = useState(firstUnscored)
  const [partial, setPartial] = useState<PartialInput>({
    active: false,
    value: "",
  })

  const cellsRef = useRef(initialCells)
  const selectedRef = useRef(firstUnscored)
  const partialRef = useRef(partial)
  const notifiedRef = useRef(false)
  const isActiveRef = useRef(isActive)
  // 模範解答＋生徒答案を inline で並べる折り返しグリッド（列数の実測に使う）
  const gridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const setCellsSynced = (next: DemoCell[]) => {
    cellsRef.current = next
    setCells(next)
  }
  const setSelectedSynced = (n: number) => {
    selectedRef.current = n
    setSelected(n)
  }
  const setPartialSynced = (p: PartialInput) => {
    partialRef.current = p
    setPartial(p)
  }

  const applyStatus = useCallback((status: DemoStatus, score?: number) => {
    const sel = selectedRef.current
    const updated = cellsRef.current.map((c, i) =>
      i === sel ? { ...c, status, score } : c
    )
    setCellsSynced(updated)
    const after = updated.findIndex(
      (c, i) => i > sel && c.status === "unscored"
    )
    const wrap =
      after === -1 ? updated.findIndex((c) => c.status === "unscored") : after
    if (wrap !== -1) setSelectedSynced(wrap)
  }, [])

  /** 折り返しグリッドの先頭行に並ぶセル数（模範解答含む）を DOM から実測 */
  const measureColumns = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return 1
    const items = Array.from(grid.children) as HTMLElement[]
    if (items.length === 0) return 1
    const top0 = items[0].offsetTop
    let cols = 0
    for (const it of items) {
      if (it.offsetTop === top0) cols++
      else break
    }
    return Math.max(1, cols)
  }, [])

  /**
   * 本番（right-down レイアウト）と同じ移動仕様。
   * 模範解答を index 0 に含む結合配列で考え、W/S は ∓cols（行をまたぐ）、
   * 端では ∓1 にフォールバック、A/D は ±1。模範解答（0）には止まらない。
   */
  const moveSelection = useCallback(
    (dir: "up" | "down" | "left" | "right") => {
      const n = cellsRef.current.length
      const total = n + 1 // 模範解答 + 生徒答案
      const cols = measureColumns()
      const cur = selectedRef.current + 1 // 結合配列での現在位置
      let next = cur
      if (dir === "left") next = cur - 1
      else if (dir === "right") next = cur + 1
      else if (dir === "up") {
        next = cur - cols
        if (next < 0) next = Math.max(0, cur - 1)
      } else if (dir === "down") {
        next = cur + cols
        if (next >= total) next = Math.min(total - 1, cur + 1)
      }
      next = Math.max(0, Math.min(total - 1, next))
      // 模範解答（結合 index 0）には選択を止めない
      if (next === 0) return
      setSelectedSynced(next - 1)
    },
    [measureColumns]
  )

  const openPartial = useCallback((initial: string) => {
    setPartialSynced({ active: true, value: initial })
  }, [])

  const editPartial = useCallback((char: string) => {
    const cur = partialRef.current.value
    if (char === "⌫") {
      setPartialSynced({ active: true, value: cur.slice(0, -1) })
      return
    }
    if (char === "." && cur.includes(".")) return
    const next = cur + char
    if (Number(next) > MAX_SCORE) return
    if (next.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: next })
  }, [])

  const setPartialValue = useCallback((v: string) => {
    if (!/^\d*\.?\d*$/.test(v)) return
    if (Number(v) > MAX_SCORE) return
    if (v.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: v })
  }, [])

  const confirmPartial = useCallback(() => {
    const v = partialRef.current.value
    if (v === "" || v === ".") {
      setPartialSynced({ active: false, value: "" })
      return
    }
    const num = Math.min(MAX_SCORE, Math.max(0, Number(v)))
    setPartialSynced({ active: false, value: "" })
    applyStatus("partial", num)
  }, [applyStatus])

  const confirmPending = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
    applyStatus("pending")
  }, [applyStatus])

  const cancelPartial = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
  }, [])

  const keyToStatus = useMemo(() => {
    const map: Record<string, DemoStatus> = {}
    markOrder.forEach((status) => {
      const k = rawKeys[status]
      if (k) map[k.toLowerCase()] = status
    })
    return map
  }, [markOrder, rawKeys])

  useEffect(() => {
    const partialKey = (rawKeys.partial || "").toLowerCase()
    const pendingKey = (rawKeys.pending || "").toLowerCase()
    const handler = (e: KeyboardEvent) => {
      // 入力対象のステップ、または部分点モーダル表示中だけ働く
      if (!isActiveRef.current && !partialRef.current.active) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      const block = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }

      if (partialRef.current.active) {
        if (/^[0-9.]$/.test(key)) {
          block()
          editPartial(key)
        } else if (key === "Backspace") {
          block()
          editPartial("⌫")
        } else if (key === partialKey || key === "Enter") {
          block()
          confirmPartial()
        } else if (key === pendingKey) {
          block()
          confirmPending()
        } else if (key === "Escape") {
          block()
          cancelPartial()
        } else if (keyToStatus[key]) {
          // 採点キーは本番に漏らさない（モーダル中は無視）
          block()
        }
        return
      }

      // WASD で選択を移動
      if (key === navKeys.left) {
        block()
        moveSelection("left")
        return
      }
      if (key === navKeys.right) {
        block()
        moveSelection("right")
        return
      }
      if (key === navKeys.up) {
        block()
        moveSelection("up")
        return
      }
      if (key === navKeys.down) {
        block()
        moveSelection("down")
        return
      }

      if (allowPartial && /^[0-9]$/.test(key)) {
        block()
        openPartial(key)
        return
      }
      if (allowPartial && key === partialKey) {
        block()
        openPartial("")
        return
      }

      const status = keyToStatus[key]
      if (status && status !== "partial") {
        block()
        applyStatus(status)
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [
    keyToStatus,
    allowPartial,
    rawKeys.partial,
    rawKeys.pending,
    navKeys,
    moveSelection,
    applyStatus,
    openPartial,
    editPartial,
    confirmPartial,
    confirmPending,
    cancelPartial,
  ])

  const allScored = cells.every((c) => c.status !== "unscored")

  useEffect(() => {
    if (allScored && !notifiedRef.current) {
      notifiedRef.current = true
      onAllScored?.()
    }
  }, [allScored, onAllScored])

  const reset = () => {
    notifiedRef.current = false
    setCellsSynced(initialCells)
    setSelectedSynced(firstUnscored)
    setPartialSynced({ active: false, value: "" })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">設問例「{questionExample}」</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          className="h-7 gap-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          やり直す
        </Button>
      </div>

      {/* 採点グリッド（本番と同じセル表示）。模範解答＋生徒答案を inline で並べ、
          幅に応じて折り返す。模範解答は先頭セル（結合 index 0）。 */}
      <div ref={gridRef} className="flex flex-wrap gap-2">
        <div
          className={`${DEMO_CELL_W} flex shrink-0 flex-col gap-1 border-2 border-black bg-white p-2`}
        >
          <div className="flex h-14 items-center justify-center bg-white">
            <span
              className={`font-semibold text-gray-800 ${
                masterAnswer.length > 4 ? "text-lg" : "text-3xl"
              }`}
            >
              {masterAnswer}
            </span>
          </div>
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-xs font-bold text-black">
              模範解答
            </span>
            <Badge
              variant="outline"
              className="h-4 border-black bg-white px-1 text-xs text-black"
            >
              {MAX_SCORE}点満点
            </Badge>
          </div>
        </div>

        {cells.map((cell, i) => {
          const isSelected = i === selected
          const c = cfg[cell.status]
          const Icon = c.icon
          const bg = isSelected ? c.selectedBgStyle : c.bgStyle
          const sd = scoreText(cell)
          return (
            <button
              type="button"
              key={cell.name}
              onClick={() => setSelectedSynced(i)}
              className={`${DEMO_CELL_W} flex shrink-0 flex-col gap-1 border-2 p-2 text-left outline-none focus:outline-none focus-visible:outline-none`}
              style={{
                ...bg,
                borderColor: isSelected ? selectionColor : "transparent",
              }}
            >
              <div className="flex h-14 items-center justify-center bg-white">
                <span
                  className={
                    cell.answer === "（空欄）"
                      ? "text-sm text-gray-400"
                      : `text-blue-900/80 ${
                          cell.answer.length > 4 ? "text-base" : "text-3xl"
                        }`
                  }
                  style={
                    cell.answer === "（空欄）"
                      ? undefined
                      : { fontFamily: "cursive" }
                  }
                >
                  {cell.answer}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1">
                <span
                  className="truncate text-xs font-medium"
                  style={c.textStyle}
                >
                  {cell.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {sd && (
                    <Badge variant="outline" className="h-4 px-1 text-xs">
                      {sd}
                    </Badge>
                  )}
                  <Icon className="h-3 w-3" style={c.iconStyle} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 印（採点ボタン）。本番 ScoringToolbar と完全に同一（ツールチップ含む） */}
      <ScoringButtonRow
        markOrder={markOrder}
        rawKeys={rawKeys}
        onScore={(status) =>
          status === "partial" ? openPartial("") : applyStatus(status)
        }
      />

      {/* 部分点の入力は本番のモーダルをそのまま再利用 */}
      <PartialScoreModal
        isOpen={partial.active}
        value={partial.value}
        maxPoints={MAX_SCORE}
        questionLabel="1"
        onClose={cancelPartial}
        onChange={setPartialValue}
        onConfirmPartial={confirmPartial}
        onConfirmPending={confirmPending}
        onDigit={(k) => editPartial(k)}
        onBackspace={() => editPartial("⌫")}
        keyBindings={{
          partialKey: rawKeys.partial,
          pendingKey: rawKeys.pending,
          cancelKey: "Escape",
        }}
      />

      {allScored && !partial.active && completion}
    </div>
  )
}

/**
 * 各セクションのブロック。一般的なヘルプページのように、上から下へ
 * 自然にスクロールして読み進められるよう、適度な余白だけを与える。
 */
function Scene({
  children,
  sceneRef,
}: {
  children: React.ReactNode
  sceneRef?: React.Ref<HTMLDivElement>
}) {
  return (
    <section ref={sceneRef} className="scroll-mt-8 pb-20 last:pb-4 sm:pb-28">
      {children}
    </section>
  )
}

/** デモの見出し＋説明。スクロール位置で下線が青く伸びてフォーカスを示す */
function DemoSection({
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

/**
 * 採点の体験デモ。②選択 → ③採点 → ④部分点 の3シーンを上下に並べ、
 * スクロール位置（覆っている最前面のシーン）で「入力対象」を判定し、
 * キーボードの行き先を自動で切り替える。
 */
const DEMO_TITLE_SELECT = "② 一覧表示で答案を表示する"
const DEMO_TITLE_SCORE = "③ 採点する"
const DEMO_TITLE_PARTIAL = "④ 部分点をつける"

function ScoringDemos({
  rawKeys,
  navKeys,
  keys,
}: {
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  keys: GuideKeys
}) {
  // 入力対象（キーボードの行き先）は、フォーカス中の見出しと一致するデモ
  const activeSelect = useHeadingActive(DEMO_TITLE_SELECT)
  const activeScore = useHeadingActive(DEMO_TITLE_SCORE)
  const activePartial = useHeadingActive(DEMO_TITLE_PARTIAL)
  const sec3Ref = useRef<HTMLDivElement>(null)

  // 「採点できました。」を一瞬見せてから次へ。急に動くと驚くので 1 秒待つ。
  const goPartial = useCallback(() => {
    setTimeout(() => {
      sec3Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 1000)
  }, [])

  return (
    <>
      <Scene>
        <DemoSection
          title={DEMO_TITLE_SELECT}
          instruction={
            <>
              一覧表示では、同じ設問の答案を全員ぶん並べて表示します。
              左上の黒い枠で囲まれているのが模範解答で、それ以外が生徒の答案です。
              クリック、または{" "}
              <span className="inline-flex items-center gap-1">
                <Kbd>{formatKey(navKeys.up)}</Kbd>
                <Kbd>{formatKey(navKeys.left)}</Kbd>
                <Kbd>{formatKey(navKeys.down)}</Kbd>
                <Kbd>{formatKey(navKeys.right)}</Kbd>
              </span>{" "}
              で選択を変えられます。
            </>
          }
        >
          <ScoringGridDemo
            initialCells={SELECT_CELLS}
            markOrder={[]}
            allowPartial={false}
            rawKeys={rawKeys}
            navKeys={navKeys}
            questionExample="7 + 5 = ?"
            masterAnswer="12"
            isActive={activeSelect}
          />
        </DemoSection>
      </Scene>

      <Scene>
        <DemoSection
          title={DEMO_TITLE_SCORE}
          instruction={
            <>
              選択した答案と、左上の模範解答を見くらべます。 正しければ 正答（
              <Kbd>{keys.correct}</Kbd>
              ）を、誤っていれば 誤答（<Kbd>{keys.incorrect}</Kbd>）を押します。
              採点すると、自動的に次の答案へ進みます。採点ボタンとキーボードのどちらでも操作できます。
            </>
          }
        >
          <ScoringGridDemo
            initialCells={STAGE1_CELLS}
            markOrder={["correct", "incorrect"]}
            allowPartial={false}
            rawKeys={rawKeys}
            navKeys={navKeys}
            questionExample="7 + 5 = ?"
            masterAnswer="12"
            isActive={activeScore}
            onAllScored={goPartial}
            completion={
              <p className="mt-3 text-sm font-medium text-gray-600">
                採点できました。下の「部分点をつける」に進みましょう。
              </p>
            }
          />
        </DemoSection>
      </Scene>

      <Scene sceneRef={sec3Ref}>
        <DemoSection
          title={DEMO_TITLE_PARTIAL}
          instruction={
            <>
              部分点をつけたいときは数字キーを押します。たとえば <Kbd>5</Kbd>{" "}
              を押すと部分点の入力画面が開き、点数を調整できます。点数を決めたら
              確定（<Kbd>{keys.partial}</Kbd>）を押して部分点を確定します。
            </>
          }
        >
          <ScoringGridDemo
            initialCells={STAGE2_CELLS}
            markOrder={[
              "correct",
              "incorrect",
              "partial",
              "no_answer",
              "pending",
            ]}
            allowPartial
            rawKeys={rawKeys}
            navKeys={navKeys}
            questionExample="1辺3cmの正方形の面積は？"
            masterAnswer="9cm²"
            isActive={activePartial}
            completion={
              <p className="mt-3 text-sm font-medium text-gray-600">
                ひととおり採点できました。
              </p>
            }
          />
        </DemoSection>
      </Scene>
    </>
  )
}

// ============================================================================
// 困ったとき（共通）
// ============================================================================

function Troubleshoot({ pending }: { pending: string }) {
  return (
    <Scene>
      <FocusSection title="困ったときは">
        <Callout type="success" title="間違えた・迷ったとき">
          <span className="inline-flex flex-wrap items-center gap-1">
            印はつけ直すだけで直せます。迷ったら「保留」（<Kbd>{pending}</Kbd>）
          </span>
          にして後で見直せます。採点内容は自動で保存されます。
        </Callout>
      </FocusSection>
    </Scene>
  )
}

// ============================================================================
// 一覧表示の案内
// ============================================================================

function GridGuide({
  rawKeys,
  navKeys,
  keys,
}: {
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  keys: GuideKeys
}) {
  return (
    <>
      <ScoringDemos rawKeys={rawKeys} navKeys={navKeys} keys={keys} />

      <Scene>
        <FocusSection title="⑤ 採点の進み方">
          <p>
            採点すると、自動的に次の答案へ進みます。一覧表示では、同じ設問の次の答案（次の生徒）へ進みます。
          </p>
          <p>
            1つの設問について、全ての生徒の採点が終わったら、次の設問へ移ります。
            <span className="inline-flex flex-wrap items-center gap-1">
              <Kbd>{keys.nextQuestion}</Kbd> で次の設問、
              <Kbd>{keys.prevQuestion}</Kbd> で前の設問へ移動できます。
            </span>
            画面のボタンでも移動できます。
          </p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title="⑥ 正しく採点できたか確認する">
          <p>
            採点が終わった後、正答にした答案や誤答にした答案だけを表示して、
            正しく採点できたかを確認できます。
          </p>
          <p>
            画面右の「表示」パネルで
            <span className="inline-flex flex-wrap items-center gap-1">
              ［正答］を押すか <Kbd>{keys.filterCorrect}</Kbd>
            </span>
            を押すと、正答にした答案だけが表示されます。誤答なら
            <span className="inline-flex flex-wrap items-center gap-1">
              ［誤答］または <Kbd>{keys.filterIncorrect}</Kbd>
            </span>
            です。もう一度押すと元に戻ります。
          </p>
        </FocusSection>
      </Scene>

      <Troubleshoot pending={keys.pending} />
    </>
  )
}

// ============================================================================
// 個別表示の案内
// ============================================================================

interface ToolKeys {
  line: string
  rectangle: string
  ellipse: string
  text: string
  select: string
  hand: string
}

const INDIV_DEMO_TITLE = "③ 採点する"

/** 個別表示の体験用：3人の答案を1人ずつ大きく表示して採点する */
const INDIV_CELLS: DemoCell[] = [
  { name: "佐藤", answer: "希望", status: "unscored" },
  { name: "鈴木", answer: "希棒", status: "unscored" },
  { name: "高橋", answer: "希望", status: "unscored" },
]

/** 採点の基準となる模範解答（答え合わせ用に常に並べて表示する） */
const INDIV_MASTER = "希望"

const INDIV_MARK_ORDER: DemoStatus[] = [
  "correct",
  "incorrect",
  "partial",
  "no_answer",
  "pending",
]

/** 個別表示で「現在採点する領域」を囲む緑の枠色（本番 #22c55e と同一） */
const REGION_GREEN = "#22c55e"

/** 答案に重ねる採点マーク（採点状態ごと） */
const SHEET_MARKS: Record<DemoStatus, string> = {
  unscored: "",
  correct: "◯",
  incorrect: "✕",
  partial: "△",
  no_answer: "／",
  pending: "?",
}

/** 答案用紙のダミー行（手書きを模した薄いプレースホルダ） */
function SheetLine({ label, widths }: { label: string; widths: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-3 shrink-0 text-[10px] text-gray-400">
        {label}
      </span>
      <div className="flex flex-1 flex-col gap-1.5 py-0.5">
        {widths.map((w, i) => (
          <span
            key={i}
            className="block h-2 rounded-sm bg-gray-200"
            style={{ width: w }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 答案用紙1枚。本番の「左右分割」では、生徒の答案用紙と模範解答の答案用紙を
 * 同じサイズ・同じレイアウトで横に並べる。生徒用は採点マーク・点数を重ね、
 * 模範解答用はそれらを出さない。
 */
function IndividualSheet({
  headerRight,
  answer,
  answerClassName,
  mark,
  markColor,
  score,
}: {
  headerRight: React.ReactNode
  answer: string
  answerClassName: string
  mark?: string
  markColor?: string
  score?: string | null
}) {
  return (
    <div className="relative w-60 rounded-sm border border-gray-300 bg-white px-4 py-3 shadow-sm">
      {/* 用紙ヘッダー */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-1.5">
        <span className="text-[11px] font-medium text-gray-600">
          {"国語　答案用紙"}
        </span>
        <span className="text-[11px] text-gray-500">{headerRight}</span>
      </div>

      <div className="space-y-3">
        <SheetLine label="一" widths={["90%", "70%"]} />
        <SheetLine label="二" widths={["80%"]} />

        {/* いま採点する領域＝緑の枠。本番と同じく枠の上に緑のラベル。 */}
        <div>
          <span
            className="ml-1 text-[10px] font-bold"
            style={{ color: REGION_GREEN }}
          >
            {"三　「きぼう」を漢字で"}
          </span>
          <div
            className="relative rounded-sm border-2 bg-white px-2 py-1.5"
            style={{ borderColor: REGION_GREEN }}
          >
            <div
              className={`flex h-10 items-center text-3xl ${answerClassName}`}
              style={{ fontFamily: "cursive" }}
            >
              {answer}
            </div>
            {mark && (
              <span
                className="pointer-events-none absolute top-1 right-2 text-5xl leading-none"
                style={{ color: markColor, transform: "rotate(-8deg)" }}
              >
                {mark}
              </span>
            )}
            {score && (
              <span
                className="absolute right-2 bottom-1 text-xs font-bold"
                style={{ color: markColor }}
              >
                {score}
              </span>
            )}
          </div>
        </div>

        <SheetLine label="四" widths={["85%", "60%"]} />
      </div>
    </div>
  )
}

/**
 * 個別表示の採点体験デモ。1人の答案を大きく表示し、採点（キー/ボタン）すると
 * 次の未採点の生徒へ。前後の生徒へは W/S（設定キー）で移動。部分点は数字キー。
 * キーボードの横取りは ScoringGridDemo と同じく window キャプチャ＋停止で、
 * このセクションが入力対象のときだけ働き、本番には影響しない。
 */
function IndividualScoringDemo({
  rawKeys,
  navKeys,
  isActive,
}: {
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
  isActive: boolean
}) {
  const colors = useScoringStatusColors()
  const [cells, setCells] = useState<DemoCell[]>(INDIV_CELLS)
  const [selected, setSelected] = useState(0)
  const [partial, setPartial] = useState<PartialInput>({
    active: false,
    value: "",
  })

  const cellsRef = useRef(INDIV_CELLS)
  const selectedRef = useRef(0)
  const partialRef = useRef(partial)
  const isActiveRef = useRef(isActive)
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const setCellsSynced = (next: DemoCell[]) => {
    cellsRef.current = next
    setCells(next)
  }
  const setSelectedSynced = (n: number) => {
    selectedRef.current = n
    setSelected(n)
  }
  const setPartialSynced = (p: PartialInput) => {
    partialRef.current = p
    setPartial(p)
  }

  const applyStatus = useCallback((status: DemoStatus, score?: number) => {
    const sel = selectedRef.current
    const updated = cellsRef.current.map((c, i) =>
      i === sel ? { ...c, status, score } : c
    )
    setCellsSynced(updated)
    // 採点したら次の未採点の生徒へ自動で進む
    const after = updated.findIndex(
      (c, i) => i > sel && c.status === "unscored"
    )
    const wrap =
      after === -1 ? updated.findIndex((c) => c.status === "unscored") : after
    if (wrap !== -1) setSelectedSynced(wrap)
  }, [])

  const moveStudent = useCallback((dir: "prev" | "next") => {
    const n = cellsRef.current.length
    const i =
      dir === "next"
        ? Math.min(n - 1, selectedRef.current + 1)
        : Math.max(0, selectedRef.current - 1)
    setSelectedSynced(i)
  }, [])

  const openPartial = useCallback((initial: string) => {
    setPartialSynced({ active: true, value: initial })
  }, [])

  const editPartial = useCallback((char: string) => {
    const cur = partialRef.current.value
    if (char === "⌫") {
      setPartialSynced({ active: true, value: cur.slice(0, -1) })
      return
    }
    if (char === "." && cur.includes(".")) return
    const next = cur + char
    if (Number(next) > MAX_SCORE) return
    if (next.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: next })
  }, [])

  const setPartialValue = useCallback((v: string) => {
    if (!/^\d*\.?\d*$/.test(v)) return
    if (Number(v) > MAX_SCORE) return
    if (v.replace(".", "").length > 3) return
    setPartialSynced({ active: true, value: v })
  }, [])

  const confirmPartial = useCallback(() => {
    const v = partialRef.current.value
    if (v === "" || v === ".") {
      setPartialSynced({ active: false, value: "" })
      return
    }
    const num = Math.min(MAX_SCORE, Math.max(0, Number(v)))
    setPartialSynced({ active: false, value: "" })
    applyStatus("partial", num)
  }, [applyStatus])

  const confirmPending = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
    applyStatus("pending")
  }, [applyStatus])

  const cancelPartial = useCallback(() => {
    setPartialSynced({ active: false, value: "" })
  }, [])

  const keyToStatus = useMemo(() => {
    const map: Record<string, DemoStatus> = {}
    INDIV_MARK_ORDER.forEach((status) => {
      const k = rawKeys[status]
      if (k) map[k.toLowerCase()] = status
    })
    return map
  }, [rawKeys])

  useEffect(() => {
    const partialKey = (rawKeys.partial || "").toLowerCase()
    const pendingKey = (rawKeys.pending || "").toLowerCase()
    const handler = (e: KeyboardEvent) => {
      if (!isActiveRef.current && !partialRef.current.active) return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const block = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }

      if (partialRef.current.active) {
        if (/^[0-9.]$/.test(key)) {
          block()
          editPartial(key)
        } else if (key === "Backspace") {
          block()
          editPartial("⌫")
        } else if (key === partialKey || key === "Enter") {
          block()
          confirmPartial()
        } else if (key === pendingKey) {
          block()
          confirmPending()
        } else if (key === "Escape") {
          block()
          cancelPartial()
        } else if (keyToStatus[key]) {
          block()
        }
        return
      }

      // 前後の生徒へ移動（W/A=前、S/D=次）
      if (key === navKeys.up || key === navKeys.left) {
        block()
        moveStudent("prev")
        return
      }
      if (key === navKeys.down || key === navKeys.right) {
        block()
        moveStudent("next")
        return
      }

      // 部分点（数字キー or 部分点キー）
      if (/^[0-9]$/.test(key)) {
        block()
        openPartial(key)
        return
      }
      if (key === partialKey) {
        block()
        openPartial("")
        return
      }

      const status = keyToStatus[key]
      if (status && status !== "partial") {
        block()
        applyStatus(status)
      }
    }
    window.addEventListener("keydown", handler, true)
    return () => window.removeEventListener("keydown", handler, true)
  }, [
    keyToStatus,
    rawKeys.partial,
    rawKeys.pending,
    navKeys,
    moveStudent,
    applyStatus,
    openPartial,
    editPartial,
    confirmPartial,
    confirmPending,
    cancelPartial,
  ])

  const reset = () => {
    setCellsSynced(INDIV_CELLS)
    setSelectedSynced(0)
    setPartialSynced({ active: false, value: "" })
  }

  const cell = cells[selected]
  const sd = scoreText(cell)
  const mark = SHEET_MARKS[cell.status]
  const scoredCount = cells.filter((x) => x.status !== "unscored").length

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">設問例「『きぼう』を漢字で」</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={reset}
          className="h-7 gap-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" />
          やり直す
        </Button>
      </div>

      {/* 本番の「左右分割」と同じく、生徒の答案用紙（左）と模範解答の答案用紙（右）を
          同じサイズ・同じレイアウトで並べて見くらべる。 */}
      <div className="flex flex-wrap items-start justify-center gap-3">
        {/* 生徒の答案用紙（左）— 採点マーク・点数を重ねる */}
        <IndividualSheet
          headerRight={
            <>
              {"氏名　"}
              {cell.name}
            </>
          }
          answer={cell.answer}
          answerClassName="text-blue-900/80"
          mark={mark}
          markColor={colors[cell.status].icon}
          score={sd}
        />

        {/* 模範解答の答案用紙（右）— 同じサイズで、領域に正答を表示 */}
        <IndividualSheet
          headerRight={
            <span className="font-bold text-rose-600">模範解答</span>
          }
          answer={INDIV_MASTER}
          answerClassName="text-rose-700"
        />
      </div>

      <ScoringButtonRow
        markOrder={INDIV_MARK_ORDER}
        rawKeys={rawKeys}
        onScore={(status) =>
          status === "partial" ? openPartial("") : applyStatus(status)
        }
      />

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          前後の生徒へは <Kbd>{formatKey(navKeys.up)}</Kbd>
          <Kbd>{formatKey(navKeys.down)}</Kbd> で移動できます。
        </span>
        <span>
          {cells.length}人のうち {scoredCount}人を採点しました。
          {scoredCount === cells.length && " 全員の採点が終わりました。"}
        </span>
      </p>

      <PartialScoreModal
        isOpen={partial.active}
        value={partial.value}
        maxPoints={MAX_SCORE}
        questionLabel="1"
        onClose={cancelPartial}
        onChange={setPartialValue}
        onConfirmPartial={confirmPartial}
        onConfirmPending={confirmPending}
        onDigit={(k) => editPartial(k)}
        onBackspace={() => editPartial("⌫")}
        keyBindings={{
          partialKey: rawKeys.partial,
          pendingKey: rawKeys.pending,
          cancelKey: "Escape",
        }}
      />
    </div>
  )
}

type DrawToolKind =
  | "line"
  | "rectangle"
  | "ellipse"
  | "text"
  | "select"
  | "hand"

/** ツール説明アニメの答案下地（薄いプレースホルダ行） */
function ToolBackdrop() {
  return (
    <>
      <rect
        x="4"
        y="6"
        width="112"
        height="52"
        rx="4"
        fill="white"
        stroke="#e5e7eb"
        strokeWidth="1.5"
      />
      <line
        x1="14"
        y1="22"
        x2="74"
        y2="22"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="36"
        x2="90"
        y2="36"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="14"
        y1="50"
        x2="64"
        y2="50"
        stroke="#e5e7eb"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  )
}

/** ③のツール説明アニメ（CSS）。記号を描く／コメント／選択／手のひら。 */
function DrawToolAnimation({ tool }: { tool: DrawToolKind }) {
  const colors = useScoringStatusColors()
  const red = colors.incorrect.icon
  const blue = "#3b82f6"
  const lineLen = 74
  const rectLen = 2 * (44 + 24)
  const circleLen = 2 * Math.PI * 15

  return (
    <svg viewBox="0 0 120 64" className="h-16 w-full">
      {tool === "hand" ? (
        <g style={{ animation: "help07Pan 3.2s ease-in-out infinite" }}>
          <ToolBackdrop />
          <text x="82" y="44" fontSize="22">
            ✋
          </text>
        </g>
      ) : (
        <ToolBackdrop />
      )}

      {tool === "line" && (
        <line
          x1="14"
          y1="30"
          x2="88"
          y2="30"
          stroke={red}
          strokeWidth="3"
          strokeLinecap="round"
          style={
            {
              strokeDasharray: lineLen,
              "--help07-len": lineLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "rectangle" && (
        <rect
          x="56"
          y="14"
          width="44"
          height="24"
          rx="2"
          fill="none"
          stroke={red}
          strokeWidth="3"
          style={
            {
              strokeDasharray: rectLen,
              "--help07-len": rectLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "ellipse" && (
        <circle
          cx="80"
          cy="32"
          r="15"
          fill="none"
          stroke={red}
          strokeWidth="3"
          style={
            {
              strokeDasharray: circleLen,
              "--help07-len": circleLen,
              animation: "help07Pen 3.6s infinite",
            } as CSSProperties
          }
        />
      )}
      {tool === "text" && (
        <text
          x="56"
          y="38"
          fill={red}
          fontSize="16"
          fontWeight="bold"
          style={
            {
              fontFamily: "cursive",
              transformOrigin: "56px 38px",
              animation: "help07Mark 3.6s infinite",
            } as CSSProperties
          }
        >
          よし!
        </text>
      )}
      {tool === "select" && (
        <>
          <circle
            cx="46"
            cy="32"
            r="12"
            fill="none"
            stroke={red}
            strokeWidth="2.5"
          />
          <rect
            x="30"
            y="16"
            width="32"
            height="32"
            fill="none"
            stroke={blue}
            strokeWidth="1.5"
            strokeDasharray="4 3"
            style={{ animation: "help07March 0.6s linear infinite" }}
          />
        </>
      )}
    </svg>
  )
}

/** ③のツールカード：上にアニメ、下に名前・キー・説明 */
function DrawToolCard({
  tool,
  name,
  desc,
  keyLabel,
}: {
  tool: DrawToolKind
  name: string
  desc: string
  keyLabel: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="flex h-16 w-full items-center justify-center">
        <DrawToolAnimation tool={tool} />
      </div>
      <div className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-sm font-semibold text-gray-800">{name}</span>
          <kbd className="rounded border border-gray-300 bg-white px-1 font-mono text-[10px] text-gray-600">
            {keyLabel}
          </kbd>
        </div>
        <div className="mt-0.5 text-xs leading-snug text-gray-500">{desc}</div>
      </div>
    </div>
  )
}

/**
 * 模範解答の表示モードの図（答=生徒答案・模=模範解答）。
 * 模範解答が現れて消えるアニメーションで、表示の切り替えを表す。
 * 横幅3分割のグリッドに並べて使うため、列いっぱいに広がる。
 */
function DisplayModeMini({
  mode,
}: {
  mode: "overlay" | "split-h" | "split-v"
}) {
  if (mode === "overlay") {
    return (
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded border border-gray-300 bg-white">
        <span className="text-2xl font-bold text-blue-900/70">答</span>
        <span
          className="absolute inset-0 flex items-center justify-center bg-rose-500/10 text-2xl font-bold text-rose-500/60"
          style={{ animation: "help07Master 4s infinite" }}
        >
          模
        </span>
      </div>
    )
  }
  if (mode === "split-h") {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-gray-300 bg-white">
        {/* 答案用紙：中央から左半分の中央へ寄る */}
        <div
          className="absolute inset-y-0 left-0 flex w-full items-center justify-center text-2xl font-bold text-blue-900/70"
          style={{ animation: "help07SheetH 4s infinite" }}
        >
          答
        </div>
        {/* 模範解答：右からスライドインして右半分に入る */}
        <div
          className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center border-l border-gray-300 bg-rose-50 text-2xl font-bold text-rose-500/70"
          style={{ animation: "help07MasterSlideH 4s infinite" }}
        >
          模
        </div>
      </div>
    )
  }
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded border border-gray-300 bg-white">
      {/* 答案用紙：中央から上半分の中央へ寄る */}
      <div
        className="absolute inset-x-0 top-0 flex h-full items-center justify-center text-2xl font-bold text-blue-900/70"
        style={{ animation: "help07SheetV 4s infinite" }}
      >
        答
      </div>
      {/* 模範解答：下からスライドインして下半分に入る */}
      <div
        className="absolute inset-x-0 bottom-0 flex h-1/2 items-center justify-center border-t border-gray-300 bg-rose-50 text-2xl font-bold text-rose-500/70"
        style={{ animation: "help07MasterSlideV 4s infinite" }}
      >
        模
      </div>
    </div>
  )
}

const BEHAVIOR_NAMES = ["佐藤", "鈴木", "高橋"]
const BEHAVIOR_ROW_TOPS = [24, 48, 72]

/**
 * 採点時の動作のアニメ（CSS）。1枚の答案＋緑枠で表す。
 * - next-question: 同じ答案のまま、緑枠が次の設問へ下がっていく
 * - next-student : 緑枠は同じ位置のまま、答案（生徒）が次々と変わる
 */
function BehaviorAnimation({
  mode,
}: {
  mode: "next-question" | "next-student"
}) {
  const cycle = mode === "next-student"
  const frameStyle: CSSProperties = cycle
    ? { top: BEHAVIOR_ROW_TOPS[1] - 1 }
    : {
        top: BEHAVIOR_ROW_TOPS[0] - 1,
        animation: "help07FrameDown 3s infinite",
      }
  return (
    <div className="relative h-28 w-28 rounded-sm border border-gray-300 bg-white">
      {/* 氏名 */}
      <div className="absolute top-1.5 left-2 h-3 text-[8px] font-medium text-gray-500">
        {cycle ? (
          <div className="relative h-3 w-20">
            {BEHAVIOR_NAMES.map((n, i) => (
              <span
                key={n}
                className="absolute inset-0"
                style={{ animation: `help07Show3 3s ${i}s infinite` }}
              >
                氏名 {n}
              </span>
            ))}
          </div>
        ) : (
          <span>氏名 佐藤</span>
        )}
      </div>

      {/* 設問の行（手書きを模した薄い線） */}
      {BEHAVIOR_ROW_TOPS.map((t) => (
        <span
          key={t}
          className="absolute left-2 block h-2 rounded-sm bg-gray-200"
          style={{ top: t + 6, width: "72%" }}
        />
      ))}

      {/* いま採点する領域＝緑枠 */}
      <div
        className="absolute left-1 rounded-sm border-2"
        style={{
          width: "calc(100% - 8px)",
          height: 22,
          borderColor: REGION_GREEN,
          ...frameStyle,
        }}
      />
    </div>
  )
}

/** 採点時の動作カード：アニメ＋名前＋ひとこと説明 */
function BehaviorCard({
  mode,
  title,
  desc,
}: {
  mode: "next-question" | "next-student"
  title: string
  desc: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <BehaviorAnimation mode={mode} />
      <div className="text-center">
        <div className="text-sm font-semibold text-gray-800">{title}</div>
        <div className="text-xs leading-snug text-gray-500">{desc}</div>
      </div>
    </div>
  )
}

function IndividualGuide({
  toolKeys,
  keys,
  rawKeys,
  navKeys,
}: {
  toolKeys: ToolKeys
  keys: GuideKeys
  rawKeys: Record<DemoStatus, string>
  navKeys: NavKeys
}) {
  const activeScore = useHeadingActive(INDIV_DEMO_TITLE)
  return (
    <>
      <Scene>
        <FocusSection title="② 個別表示で答案を表示する">
          <p>
            個別表示では、1人ぶんの解答用紙の<strong>全体</strong>
            を大きく表示します。
            <span className="font-semibold" style={{ color: REGION_GREEN }}>
              緑色の長方形
            </span>
            で囲まれているのが、いま採点する領域で、それ以外が別の設問の解答です。
          </p>
          <p>
            模範解答の表示方法は、画面右にある「表示モード」で、オーバーレイ・左右分割・上下分割の3つから選べます。
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center gap-1.5">
              <DisplayModeMini mode="overlay" />
              <span className="text-xs font-medium text-gray-700">
                オーバーレイ
              </span>
              <span className="text-[11px] text-gray-500">答案に重ねる</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <DisplayModeMini mode="split-h" />
              <span className="text-xs font-medium text-gray-700">
                左右分割
              </span>
              <span className="text-[11px] text-gray-500">横に並べる</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <DisplayModeMini mode="split-v" />
              <span className="text-xs font-medium text-gray-700">
                上下分割
              </span>
              <span className="text-[11px] text-gray-500">縦に並べる</span>
            </div>
          </div>
          <p>
            <span className="inline-flex h-5 items-center rounded border border-gray-300 bg-white px-1.5 align-text-bottom">
              <Eye className="h-3.5 w-3.5 text-gray-700" />
            </span>{" "}
            または <Kbd>{keys.toggleMaster}</Kbd>{" "}
            を押して、模範解答を表示するか切り替えることができます。 ［
            <strong>押し続けて表示</strong>］をオンにすると、{" "}
            <Kbd>{keys.toggleMaster}</Kbd>{" "}
            を押している時だけ模範解答を表示することもできます。
          </p>
          <p>オーバーレイのときは「不透明度」で濃さを調整できます。</p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title={INDIV_DEMO_TITLE}>
          <p>
            緑の領域の答案と、並べて表示した模範解答を見くらべます。 正しければ
            正答（<Kbd>{keys.correct}</Kbd>）を、誤っていれば 誤答（
            <Kbd>{keys.incorrect}</Kbd>
            ）を押します。採点すると、自動的に次の答案へ進みます。採点ボタンとキーボードのどちらでも操作できます。
          </p>
          <IndividualScoringDemo
            rawKeys={rawKeys}
            navKeys={navKeys}
            isActive={activeScore}
          />
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title="④ 部分点をつける">
          <p>
            部分点をつけたいときは数字キーを押します。たとえば <Kbd>5</Kbd>{" "}
            を押すと部分点の入力画面が開き、点数を調整できます。点数を決めたら
            確定（<Kbd>{keys.partial}</Kbd>）を押して部分点を確定します。
          </p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title="⑤ 採点の進み方">
          <p>
            採点すると、自動的に次の答案へ進みます。個別表示では、その進み先（
            <strong>次の生徒</strong>か、<strong>次の設問</strong>か）を、
            画面右にある「採点時の動作」で選べます。
          </p>
          <div className="flex flex-wrap gap-4">
            <BehaviorCard
              mode="next-student"
              title="次の生徒の同じ設問"
              desc="緑枠は同じ位置のまま、答案（生徒）が次々と変わります。"
            />
            <BehaviorCard
              mode="next-question"
              title="同じ生徒の次の設問"
              desc="同じ答案のまま、緑枠が次の設問へ下がっていきます。"
            />
          </div>
          <p>
            手動で生徒を切り替えたいときは、画面上部の「生徒答案」にある{" "}
            <span className="inline-flex items-center gap-1">
              ［←］［→］ボタンを押すか、<Kbd>{formatKey(navKeys.up)}</Kbd>
              <Kbd>{formatKey(navKeys.down)}</Kbd> キー
            </span>
            を押します。名前のドロップダウンから直接選ぶこともできます。となりに表示される「1
            / 9」は、9人のうち何人目を表示しているかをあらわします。
          </p>
          <p>
            設問を切り替えるには、
            <span className="inline-flex flex-wrap items-center gap-1">
              <Kbd>{keys.nextQuestion}</Kbd> で次の設問、
              <Kbd>{keys.prevQuestion}</Kbd> で前の設問へ移動できます。
            </span>
            画面のボタンでも移動できます。
          </p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title="⑥ 正しく採点できたか確認する">
          <p>
            採点が終わった後、正答にした答案や誤答にした答案だけを表示して、
            正しく採点できたかを確認できます。個別表示には状態でしぼり込む機能がないので、
            <span className="inline-flex flex-wrap items-center gap-1">
              <Kbd>{keys.toggleView}</Kbd>{" "}
              で一覧表示に切り替えてから確認します。
            </span>
          </p>
          <p>
            画面右の「表示」パネルで
            <span className="inline-flex flex-wrap items-center gap-1">
              ［正答］を押すか <Kbd>{keys.filterCorrect}</Kbd>
            </span>
            を押すと、正答にした答案だけが表示されます。誤答なら
            <span className="inline-flex flex-wrap items-center gap-1">
              ［誤答］または <Kbd>{keys.filterIncorrect}</Kbd>
            </span>
            です。もう一度押すと元に戻ります。確認できたら、
            <Kbd>{keys.toggleView}</Kbd> で個別表示に戻れます。
          </p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title="⑦ 答案に記号やコメントを書き込む">
          <p>
            個別表示では、答案の上に直接、丸や線、コメントを書き込めます。
            一覧表示にはない、個別表示だけの機能です。
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DrawToolCard
              tool="line"
              name="直線"
              desc="まっすぐ線を引く"
              keyLabel={toolKeys.line}
            />
            <DrawToolCard
              tool="rectangle"
              name="四角"
              desc="四角で囲む"
              keyLabel={toolKeys.rectangle}
            />
            <DrawToolCard
              tool="ellipse"
              name="丸"
              desc="丸で囲む"
              keyLabel={toolKeys.ellipse}
            />
            <DrawToolCard
              tool="text"
              name="文字"
              desc="コメントを書く"
              keyLabel={toolKeys.text}
            />
            <DrawToolCard
              tool="select"
              name="選択"
              desc="選んで動かす・消す（Delete）"
              keyLabel={toolKeys.select}
            />
            <DrawToolCard
              tool="hand"
              name="手のひら"
              desc="答案を持って動かす"
              keyLabel={toolKeys.hand}
            />
          </div>
          <Callout type="tip" title="色と太さ">
            線や文字の色（8色）と太さは、ツールを選んだときに変えられます。
          </Callout>
          <Callout type="success" title="書き込みは自動で残ります">
            書いた内容は自動で保存され、一覧表示に戻っても残ります。
            「結果出力（08）」で採点済み答案PDFを作ると、書き込みもそのまま印刷されます。
          </Callout>
        </FocusSection>
      </Scene>

      <Troubleshoot pending={keys.pending} />
    </>
  )
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
        for (const el of headings) {
          const top = el.getBoundingClientRect().top - rootTop
          if (top - 8 <= line) current = el.dataset.helpHeading ?? current
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
