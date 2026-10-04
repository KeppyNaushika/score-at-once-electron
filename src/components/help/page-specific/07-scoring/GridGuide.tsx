import { KeyCap } from "@/components/help/common/DocComponents"

import { FocusSection } from "./HeadingFocus"
import { Scene } from "./Scene"
import { ScoringDemos } from "./ScoringDemos"
import { Troubleshoot } from "./Troubleshoot"
import type { DemoStatus, GuideKeys, NavKeys } from "./types"

/** 一覧表示の案内 */
export function GridGuide({
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
            正しく採点できたかを確認できます。
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
            です。もう一度押すと元に戻ります。
          </p>
        </FocusSection>
      </Scene>

      <Troubleshoot pending={keys.pending} />
    </>
  )
}
