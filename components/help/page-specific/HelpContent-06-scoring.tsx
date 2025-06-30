"use client"

import { BarChart3, Keyboard, Users, Settings, CheckCircle, Lightbulb, Info } from "lucide-react"
import { HelpSection, StepItem, TipItem, ShortcutItem } from "../common/HelpComponents"

export function HelpContent06Scoring() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <BarChart3 className="h-6 w-6 text-red-600" />
          採点作業の使い方
        </h2>
        <p className="text-muted-foreground">
          キーボードショートカットを使って効率的に採点を行います。複数教員での協調採点にも対応。
        </p>
      </div>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-blue-600" />}
        title="基本的な採点手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="答案と設問を確認"
            description="表示された答案画像と採点対象の設問を確認"
          />
          <StepItem
            number={2}
            title="点数を入力"
            description="数字キー（0-9）で点数を直接入力"
            isImportant
          />
          <StepItem
            number={3}
            title="次の答案へ移動"
            description="Spaceキーで次の答案に進む"
          />
          <StepItem
            number={4}
            title="必要に応じてコメント"
            description="?キーでコメント入力モードに切り替え"
          />
        </div>
      </HelpSection>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="主要なキーボードショートカット"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <h4 className="mb-2 text-sm font-medium text-blue-700">基本操作</h4>
            <div className="space-y-1">
              <ShortcutItem keys="0-9" description="点数を直接入力" />
              <ShortcutItem keys="Space" description="次の答案に進む" />
              <ShortcutItem keys="Backspace" description="前の答案に戻る" />
              <ShortcutItem keys="Enter" description="入力確定して次へ" />
            </div>
          </div>
          <div>
            <h4 className="mb-2 text-sm font-medium text-green-700">便利機能</h4>
            <div className="space-y-1">
              <ShortcutItem keys="F" description="満点を入力" />
              <ShortcutItem keys="X" description="0点を入力" />
              <ShortcutItem keys="?" description="コメント入力" />
              <ShortcutItem keys="Tab" description="次の設問に移動" />
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-yellow-600" />}
        title="表示モードの切り替え"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border-l-4 border-blue-500 pl-3">
            <h4 className="text-sm font-medium text-blue-700">設問拡大モード</h4>
            <p className="text-xs text-muted-foreground">現在採点中の設問領域を拡大表示</p>
            <p className="text-xs text-blue-600">詳細な確認に最適</p>
          </div>
          <div className="border-l-4 border-green-500 pl-3">
            <h4 className="text-sm font-medium text-green-700">全体表示モード</h4>
            <p className="text-xs text-muted-foreground">答案全体を表示して文脈を把握</p>
            <p className="text-xs text-green-600">記述問題の採点に有効</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Users className="h-5 w-5 text-purple-600" />}
        title="複数教員での協調採点"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-purple-700">分担採点の例</h4>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
              <div className="text-xs space-y-1">
                <p>• A先生: 問1-3（計算問題）</p>
                <p>• B先生: 問4-6（記述問題）</p>
                <p>• C先生: 問7-9（証明問題）</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <h4 className="text-xs font-medium text-orange-800">競合回避システム</h4>
            <p className="text-xs text-orange-700">
              同じ答案を複数の教員が採点しようとした場合、システムが自動的に検出して警告表示
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="採点データの管理"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">自動保存機能</h4>
            <p className="text-xs text-muted-foreground">
              採点データは入力と同時に自動保存されます。
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium">採点履歴の確認</h4>
            <p className="text-xs text-muted-foreground">
              「いつ」「誰が」「何点付けたか」の履歴を確認できます。
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h4 className="text-xs font-medium text-blue-800">採点の修正</h4>
            <p className="text-xs text-blue-700">
              採点完了後でも点数の修正は可能です。必要に応じて再採点できます。
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な採点のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>キーボード中心の操作:</strong>
            数字キー、Space、Backspaceの3つを覚えるだけで大幅に効率化されます。
          </TipItem>

          <TipItem type="info">
            <strong>部分点の活用:</strong>
            小数点も入力可能です（2.5点、7.5点など）。記述問題で適切な部分点を付けましょう。
          </TipItem>

          <TipItem type="warning">
            <strong>採点基準の統一:</strong>
            複数教員で採点する場合は、事前に採点基準を明確にしておくことが重要です。
          </TipItem>
        </div>
      </HelpSection>

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="採点完了の確認"
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-sm font-medium">採点完了チェックリスト</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div>□ 全受験者の採点完了</div>
              <div>□ 未採点の設問なし</div>
            </div>
            <div>
              <div>□ 点数の入力漏れなし</div>
              <div>□ 部分点が適切に設定</div>
            </div>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}