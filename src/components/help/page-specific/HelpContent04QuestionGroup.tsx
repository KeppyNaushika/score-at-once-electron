"use client"

import {
  Calculator,
  CheckCircle,
  Grid3X3,
  Lightbulb,
  MousePointer,
  Plus,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  ShortcutItem,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContent04QuestionGroup() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Calculator className="h-6 w-6 text-blue-600" />
          小計点の設定
        </h2>
        <p className="text-muted-foreground">
          設問の点数を項目別に分けて集計できるよう、関連付けを設定しましょう。
        </p>
      </div>

      <HelpSection
        icon={<Plus className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="小計点グループを追加"
            description="「グループを追加」ボタンで、使いたい項目グループを選びます"
          />
          <StepItem
            number={2}
            title="設問と小計項目を関連付け"
            description="チェックボックスで、各設問がどの小計項目に含まれるかを設定します"
          />
          <StepItem
            number={3}
            title="小計点領域と項目を関連付け"
            description="小計点領域に、どの項目の合計を表示するかを設定します"
          />
          <StepItem
            number={4}
            title="自動で保存"
            description="チェックを入れるたびに自動で保存されます"
            isImportant
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Grid3X3 className="h-5 w-5 text-blue-600" />}
          title="小計点グループとは"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">項目の例</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">📚 大問1</Badge>
                <Badge variant="outline">📚 大問2</Badge>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">🧠 知識・理解</Badge>
                <Badge variant="secondary">💡 思考・判断</Badge>
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium">計算のしくみ</h4>
              <p className="text-muted-foreground text-sm">
                同じグループ内の項目は「どれか1つに該当（OR）」、
                別々のグループは「すべてに該当（AND）」した設問の点数を合計します
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<MousePointer className="h-5 w-5 text-indigo-600" />}
          title="素早く設定する方法"
        >
          <div className="space-y-2">
            <ShortcutItem
              keys="クリック"
              description="1つずつチェックを入れる"
            />
            <ShortcutItem
              keys="ドラッグ"
              description="まとめてチェック/解除する"
            />
            <ShortcutItem
              keys="リセット"
              description="今回の編集を取り消して直前の状態に戻す"
            />
          </div>
          <div className="mt-3 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              ドラッグ機能で、複数の設問を一度に関連付けできます
            </p>
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
            <TipItem type="info">
              <strong>設問がない：</strong>
              「採点領域作成」で設問領域を作成してから、
              このページに戻ってください。
            </TipItem>

            <TipItem type="info">
              <strong>小計点領域がない：</strong>
              「採点領域作成」で小計点領域を作成してから、
              小計点領域との関連付けができるようになります。
            </TipItem>

            <TipItem type="warning">
              <strong>グループが見つからない：</strong>
              「グループを追加」を押すと選択画面が開きます。
              必要なグループがなければ、その中の「新規作成」から作成できます。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>グループ作成：</strong>
              新しいグループは「小計点グループ管理」ページで作成・編集でき、
              複数の試験で使い回せます。
            </TipItem>

            <TipItem type="success">
              設定完了後、「次へ: 受験生徒の管理」ボタンが表示されます。
              関連付けに間違いがないか確認してから次に進みましょう。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
