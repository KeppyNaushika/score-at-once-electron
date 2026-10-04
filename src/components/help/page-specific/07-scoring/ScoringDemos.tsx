"use client"

import { useCallback, useRef } from "react"

import { KeyCap } from "@/components/help/common/DocComponents"

import { DemoSection, useHeadingActive } from "./HeadingFocus"
import { Scene } from "./Scene"
import { ScoringGridDemo } from "./ScoringGridDemo"
import type { DemoCell, DemoStatus, GuideKeys, NavKeys } from "./types"
import { formatKey } from "./utils"

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

/**
 * 採点の体験デモ。②選択 → ③採点 → ④部分点 の3シーンを上下に並べ、
 * スクロール位置（覆っている最前面のシーン）で「入力対象」を判定し、
 * キーボードの行き先を自動で切り替える。
 */
const DEMO_TITLE_SELECT = "② 一覧表示で答案を表示する"
const DEMO_TITLE_SCORE = "③ 採点する"
const DEMO_TITLE_PARTIAL = "④ 部分点をつける"

export function ScoringDemos({
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
                <KeyCap>{formatKey(navKeys.up)}</KeyCap>
                <KeyCap>{formatKey(navKeys.left)}</KeyCap>
                <KeyCap>{formatKey(navKeys.down)}</KeyCap>
                <KeyCap>{formatKey(navKeys.right)}</KeyCap>
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
              <KeyCap>{keys.correct}</KeyCap>
              ）を、誤っていれば 誤答（<KeyCap>{keys.incorrect}</KeyCap>
              ）を押します。
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
              部分点をつけたいときは数字キーを押します。たとえば{" "}
              <KeyCap>5</KeyCap>{" "}
              を押すと部分点の入力画面が開き、点数を調整できます。点数を決めたら
              確定（<KeyCap>{keys.partial}</KeyCap>
              ）を押して部分点を確定します。
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
