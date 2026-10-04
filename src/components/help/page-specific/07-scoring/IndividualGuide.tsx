"use client"

import { Eye } from "lucide-react"

import { Callout, KeyCap } from "@/components/help/common/DocComponents"

import { BehaviorCard } from "./BehaviorCard"
import { REGION_GREEN } from "./constants"
import { DisplayModeMini } from "./DisplayModeMini"
import { DrawToolCard } from "./DrawToolCard"
import { FocusSection, useHeadingActive } from "./HeadingFocus"
import { IndividualScoringDemo } from "./IndividualScoringDemo"
import { Scene } from "./Scene"
import { Troubleshoot } from "./Troubleshoot"
import type { DemoStatus, GuideKeys, NavKeys, ToolKeys } from "./types"
import { formatKey } from "./utils"

const INDIV_DEMO_TITLE = "③ 採点する"

/** 個別表示の案内 */
export function IndividualGuide({
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
              <DisplayModeMini mode="split-value" />
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
            または <KeyCap>{keys.toggleMaster}</KeyCap>{" "}
            を押して、模範解答を表示するか切り替えることができます。 ［
            <strong>押し続けて表示</strong>］をオンにすると、{" "}
            <KeyCap>{keys.toggleMaster}</KeyCap>{" "}
            を押している時だけ模範解答を表示することもできます。
          </p>
          <p>オーバーレイのときは「不透明度」で濃さを調整できます。</p>
        </FocusSection>
      </Scene>

      <Scene>
        <FocusSection title={INDIV_DEMO_TITLE}>
          <p>
            緑の領域の答案と、並べて表示した模範解答を見くらべます。 正しければ
            正答（<KeyCap>{keys.correct}</KeyCap>）を、誤っていれば 誤答（
            <KeyCap>{keys.incorrect}</KeyCap>
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
            部分点をつけたいときは数字キーを押します。たとえば{" "}
            <KeyCap>5</KeyCap>{" "}
            を押すと部分点の入力画面が開き、点数を調整できます。点数を決めたら
            確定（<KeyCap>{keys.partial}</KeyCap>）を押して部分点を確定します。
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
              ［←］［→］ボタンを押すか、<KeyCap>{formatKey(navKeys.up)}</KeyCap>
              <KeyCap>{formatKey(navKeys.down)}</KeyCap> キー
            </span>
            を押します。名前のドロップダウンから直接選ぶこともできます。となりに表示される「1
            / 9」は、9人のうち何人目を表示しているかをあらわします。
          </p>
          <p>
            設問を切り替えるには、
            <span className="inline-flex flex-wrap items-center gap-1">
              <KeyCap>{keys.nextQuestion}</KeyCap> で次の設問、
              <KeyCap>{keys.prevQuestion}</KeyCap> で前の設問へ移動できます。
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
              <KeyCap>{keys.toggleView}</KeyCap>{" "}
              で一覧表示に切り替えてから確認します。
            </span>
          </p>
          <p>
            画面右の「表示」パネルで
            <span className="inline-flex flex-wrap items-center gap-1">
              ［正答］を押すか <KeyCap>{keys.filterCorrect}</KeyCap>
            </span>
            を押すと、正答にした答案だけが表示されます。誤答なら
            <span className="inline-flex flex-wrap items-center gap-1">
              ［誤答］または <KeyCap>{keys.filterIncorrect}</KeyCap>
            </span>
            です。もう一度押すと元に戻ります。確認できたら、
            <KeyCap>{keys.toggleView}</KeyCap> で個別表示に戻れます。
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
