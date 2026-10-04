"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import type { CSSProperties } from "react"

import { useCurrentUser } from "@/contexts/CurrentUserContext"
import { useScoringStatusColors } from "@/hooks/07-score-at-once/useScoringStatusColors"
import { parsePreference } from "@/lib/userPreferences"
import { userPreferenceQuery } from "@/queries/settings"

import { FocusSection } from "./HeadingFocus"
import { Scene } from "./Scene"

/** 一覧表示の説明アニメ：答案が並び、順に印がついていく */
function GridStyleAnimation() {
  const colors = useScoringStatusColors()
  const currentUser = useCurrentUser()
  const { data: storedSelectionBorderColor } = useQuery(
    userPreferenceQuery(currentUser.id, "selectionBorderColor")
  )
  const selectionBorder =
    parsePreference(
      "selectionBorderColor",
      storedSelectionBorderColor ?? null
    ) ?? "#F97316"
  const marks = [true, false, true, true, false, true]
  return (
    <div
      className="grid grid-cols-3 gap-1.5"
      style={{ "--help07-sel": selectionBorder } as CSSProperties}
    >
      {marks.map((isCorrect, i) => (
        <div
          key={i}
          className="flex h-9 items-center justify-center rounded-sm border-2 bg-white"
          style={{ animation: `help07Sel 6s ${i * 0.7}s infinite` }}
        >
          <span
            className="text-lg font-bold"
            style={{
              color: isCorrect ? colors.correct.icon : colors.incorrect.icon,
              opacity: 0,
              animation: `help07Mark 6s ${i * 0.7}s infinite`,
            }}
          >
            {isCorrect ? "○" : "×"}
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

export function StyleChooser({
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
