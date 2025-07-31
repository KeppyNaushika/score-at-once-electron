"use client"

import {
  HelpSection,
  StepItem,
  TipItem,
  ShortcutItem,
} from "@/components/help/common/HelpComponents"
import { Info, Settings, Workflow, AlertTriangle, Lightbulb, Keyboard } from "lucide-react"

export function HelpContentSubtotalGroups() {
  return (
    <div className="space-y-6">
      <HelpSection
        icon={<Info className="h-4 w-4 text-blue-600" />}
        title="小計点グループ管理について"
      >
        <p>
          小計点グループは、複数の小計項目（大問1、大問2、リスニングなど）をまとめて管理し、
          複数のプロジェクトで再利用できる仕組みです。
        </p>
        <TipItem type="info">
          例：「数学小計」グループを作成して「代数」「幾何」「統計」の3つの小計項目を定義し、
          複数の数学テストプロジェクトで共通利用できます。
        </TipItem>
      </HelpSection>

      <HelpSection
        icon={<Settings className="h-4 w-4 text-green-600" />}
        title="基本操作"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">新規作成</h4>
            <div className="space-y-2">
              <StepItem
                number={1}
                title="グループ作成開始"
                description="「新規作成」ボタンをクリック"
              />
              <StepItem
                number={2}
                title="基本情報入力"
                description="グループ名を入力（例：国語小計、数学小計）"
              />
              <StepItem
                number={3}
                title="小計項目追加"
                description="「項目を追加」で小計項目を追加し、各項目名を入力"
              />
              <StepItem
                number={4}
                title="順序調整"
                description="ドラッグ&ドロップで項目の順序を調整"
              />
              <StepItem
                number={5}
                title="保存"
                description="「保存」で完了"
              />
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-2">編集・削除</h4>
            <p className="text-sm text-muted-foreground mb-2">
              • 編集：カード右上の鉛筆アイコンをクリック<br/>
              • 削除：カード右上のゴミ箱アイコンをクリック<br/>
              • 削除時は自動的に使用状況をチェックし、設問で使用中の場合は削除不可
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Workflow className="h-4 w-4 text-purple-600" />}
        title="プロジェクトでの利用"
      >
        <div className="space-y-2">
          <StepItem
            number={1}
            title="プロジェクトページに移動"
            description="各プロジェクトの「04-question-group」ページに移動"
          />
          <StepItem
            number={2}
            title="グループ選択"
            description="作成済みの小計点グループから選択"
          />
          <StepItem
            number={3}
            title="有効化"
            description="「グループを追加」で有効化"
          />
          <StepItem
            number={4}
            title="関連付け"
            description="設問領域と小計項目を関連付け"
          />
        </div>
        <TipItem type="info">
          同一の小計点グループを複数のプロジェクトで同時利用可能です。
          1つのグループを編集すると、利用している全プロジェクトに反映されます。
        </TipItem>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-4 w-4 text-yellow-600" />}
        title="実用例"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">国語科の場合</h4>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              グループ名：「国語基本構成」<br/>
              小計項目：<br/>
              1. 漢字・語句（10点）<br/>
              2. 読解・文法（40点）<br/>
              3. 作文・表現（50点）
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">数学科の場合</h4>
            <div className="bg-gray-50 p-3 rounded text-sm font-mono">
              グループ名：「数学標準」<br/>
              小計項目：<br/>
              1. 計算問題（30点）<br/>
              2. 文章題（35点）<br/>
              3. 図形・関数（35点）
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<AlertTriangle className="h-4 w-4 text-red-600" />}
        title="注意事項"
      >
        <TipItem type="warning">
          <div className="space-y-3">
            <div>
              <h4 className="font-medium mb-1">削除時の制限</h4>
              <p className="text-sm">
                • 設問と関連付けされている小計点グループは削除不可<br/>
                • 削除前に04-question-groupページで関連付けを解除<br/>
                • 削除実行前に詳細な使用状況が表示される
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-1">編集時の影響</h4>
              <p className="text-sm">
                • グループの編集は利用中の全プロジェクトに影響<br/>
                • 小計項目の削除は既存の関連付けも削除される<br/>
                • 採点済みデータへの影響に注意
              </p>
            </div>
          </div>
        </TipItem>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-4 w-4 text-green-600" />}
        title="効率的な運用"
      >
        <div className="space-y-3">
          <div>
            <h4 className="font-medium mb-2">推奨構成</h4>
            <p className="text-sm text-muted-foreground">
              • 教科別に標準的な小計構成を事前定義<br/>
              • 学年・コース別の構成も別途作成<br/>
              • 特別な試験用の専用構成を作成<br/>
              • 定期的に未使用グループを整理
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">命名規則</h4>
            <p className="text-sm text-muted-foreground">
              • 「教科名 + 種別」で命名（例：数学標準、英語応用）<br/>
              • 学年情報も含める（例：中3数学、高1英語）<br/>
              • 一意で分かりやすい名前を心がける
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Keyboard className="h-4 w-4 text-gray-600" />}
        title="キーボードショートカット"
      >
        <div className="space-y-2">
          <ShortcutItem keys="Ctrl+N / Cmd+N" description="新規作成" />
          <ShortcutItem keys="F5 / Ctrl+R" description="リスト更新" />
          <ShortcutItem keys="Escape" description="モーダルを閉じる" />
        </div>
      </HelpSection>
    </div>
  )
}