import { Callout, KeyCap } from "@/components/help/common/DocComponents"

import { FocusSection } from "./HeadingFocus"
import { Scene } from "./Scene"

/** 困ったとき（一覧表示・個別表示で共通） */
export function Troubleshoot({ pending }: { pending: string }) {
  return (
    <Scene>
      <FocusSection title="困ったときは">
        <Callout type="success" title="間違えた・迷ったとき">
          <span className="inline-flex flex-wrap items-center gap-1">
            印はつけ直すだけで直せます。迷ったら「保留」（
            <KeyCap>{pending}</KeyCap>）
          </span>
          にして後で見直せます。採点内容は自動で保存されます。
        </Callout>
      </FocusSection>
    </Scene>
  )
}
