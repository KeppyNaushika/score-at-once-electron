"use client"

import {
  HelpSection,
  ShortcutItem,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"
import {
  BarChart3,
  CheckCircle,
  Keyboard,
  Lightbulb,
  Settings,
} from "lucide-react"

export function HelpContent07Scoring() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          一括採点 - 使い方
        </h2>
        <p className="text-muted-foreground">
          キーボードを使って素早く採点しましょう。複数の先生で一緒に採点することもできます。
        </p>
      </div>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="答案を見る"
            description="画面に表示された生徒の答案を確認してください"
          />
          <StepItem
            number={2}
            title="キーボードで採点"
            description="Q(未採点)、E(正答)、F(部分点)、O(誤答)、P(無答)のキーを押します"
            isImportant
          />
          <StepItem
            number={3}
            title="次の答案へ"
            description="自動的に次の答案が表示されます"
          />
          <StepItem
            number={4}
            title="設問を変える"
            description="Shift+A で前の設問、Shift+D で次の設問に移動できます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Keyboard className="h-5 w-5 text-blue-600" />}
          title="採点キー"
        >
          <div className="space-y-2">
            <ShortcutItem keys="Q" description="未採点（まだ採点していない）" />
            <ShortcutItem keys="E" description="正答（正解）" />
            <ShortcutItem keys="F" description="部分点（一部正解）" />
            <ShortcutItem keys="J" description="保留（後で確認する）" />
            <ShortcutItem keys="O" description="誤答（間違い）" />
            <ShortcutItem keys="P" description="無答（何も書いてない）" />
          </div>
          <TipItem type="success">
            5つのキーでマウス不要の高速採点が可能です。
          </TipItem>
        </HelpSection>

        <HelpSection
          icon={<Settings className="h-5 w-5 text-green-600" />}
          title="移動と操作"
        >
          <div className="space-y-2">
            <ShortcutItem keys="Shift+A" description="前の設問に移る" />
            <ShortcutItem keys="Shift+D" description="次の設問に移る" />
            <ShortcutItem
              keys="W・A・S・D"
              description="答案を上下左右に移動"
            />
            <ShortcutItem keys="R" description="表示を更新" />
            <ShortcutItem keys="N" description="生徒名の表示・非表示" />
            <ShortcutItem keys="0-9" description="部分点を数字で入力" />
          </div>
          <TipItem type="info">部分点は小数点も使えます（例：2.5点）。</TipItem>
        </HelpSection>
      </div>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 xl:grid-cols-2">
        <HelpSection
          icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
          title="困ったときは"
        >
          <div className="space-y-3">
            <TipItem type="info">
              <strong>キーボードが効かない：</strong>
              画面をクリックしてからキーを押し直してください。
            </TipItem>

            <TipItem type="info">
              <strong>間違えて採点した：</strong>
              正しいキーを押し直せば点数が変更されます。
            </TipItem>

            <TipItem type="warning">
              <strong>保留機能を活用：</strong>
              迷ったときはJキーで保留にして後でまとめて確認できます。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>基本5キーをマスター：</strong>
              Q・E・F・O・Pで採点速度が大幅向上します。
            </TipItem>

            <TipItem type="success">
              <strong>部分点を活用：</strong>
              Fキー後に数字で細かい点数を入力（2.5点など）。
            </TipItem>

            <TipItem type="info">
              採点データは自動保存されるため作業中断も安心です。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
