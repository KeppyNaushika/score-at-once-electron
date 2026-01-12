"use client"

import { CheckCircle, Lightbulb, Settings, Users, Workflow } from "lucide-react"

import {
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContentSubtotalGroups() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Settings className="h-6 w-6 text-blue-600" />
          小計点グループ管理 - 使い方
        </h2>
        <p className="text-muted-foreground">
          複数のプロジェクトで再利用できる小計項目グループを作成・管理しましょう。
        </p>
      </div>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="グループを作成"
            description="「新規作成」ボタンでグループ名を入力します"
          />
          <StepItem
            number={2}
            title="小計項目を追加"
            description="「項目を追加」で小計項目を追加し、各項目名を入力"
            isImportant
          />
          <StepItem
            number={3}
            title="順序を調整"
            description="ドラッグ&ドロップで項目の順序を調整します"
          />
          <StepItem
            number={4}
            title="保存・利用"
            description="保存後、プロジェクトの04-question-groupページで利用可能"
          />
        </div>
        <TipItem type="info">
          例：「数学小計」グループで代数・幾何・統計の3項目を定義し、複数テストで共通利用可能です。
        </TipItem>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Workflow className="h-5 w-5 text-blue-600" />}
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
            同一グループを複数プロジェクトで同時利用可能です。
          </TipItem>
        </HelpSection>

        <HelpSection
          icon={<Users className="h-5 w-5 text-purple-600" />}
          title="実用例"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">国語科の場合</h4>
              <div className="rounded bg-gray-50 p-3 text-sm">
                グループ名：「国語基本構成」
                <br />
                1. 漢字・語句（10点）
                <br />
                2. 読解・文法（40点）
                <br />
                3. 作文・表現（50点）
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium">数学科の場合</h4>
              <div className="rounded bg-gray-50 p-3 text-sm">
                グループ名：「数学標準」
                <br />
                1. 計算問題（30点）
                <br />
                2. 文章題（35点）
                <br />
                3. 図形・関数（35点）
              </div>
            </div>
          </div>
        </HelpSection>
      </div>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 xl:grid-cols-2">
        <HelpSection
          icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
          title="困ったときは"
        >
          <div className="space-y-3">
            <TipItem type="warning">
              <strong>削除できない：</strong>
              設問と関連付け中のグループは削除不可です。04-question-groupページで関連付けを解除してください。
            </TipItem>

            <TipItem type="info">
              <strong>編集の影響範囲：</strong>
              グループ編集は利用中の全プロジェクトに影響します。採点済みデータにも注意が必要です。
            </TipItem>

            <TipItem type="info">
              <strong>項目の削除：</strong>
              小計項目の削除で既存の関連付けも削除されます。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>命名規則：</strong>
              「教科名 +
              種別」で命名（例：数学標準、英語応用）。学年情報も含めると分かりやすいです。
            </TipItem>

            <TipItem type="success">
              <strong>効率的な運用：</strong>
              教科別に標準構成を事前定義し、特別な試験用の専用構成も別途作成しましょう。
            </TipItem>

            <TipItem type="success">
              編集：カード右上の鉛筆アイコン、
              削除：ゴミ箱アイコンで操作できます。
              削除前に使用状況がチェックされます。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
