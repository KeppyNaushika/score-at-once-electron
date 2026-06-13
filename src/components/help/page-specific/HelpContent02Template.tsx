"use client"

import { CheckCircle, Lightbulb, Mouse, Target } from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContent02Template() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Target className="h-6 w-6 text-blue-600" />
          答案の採点領域作成 - 使い方
        </h2>
        <p className="text-muted-foreground">
          模範解答の上に採点したい範囲を四角で囲んで、採点の準備をしましょう。
        </p>
      </div>

      <HelpSection
        icon={<Mouse className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="範囲を囲む"
            description="採点したい場所をマウスでドラッグして四角く囲みます"
          />
          <StepItem
            number={2}
            title="大きさを調整"
            description="四隅の小さな四角をドラッグして大きさを調整します"
          />
          <StepItem
            number={3}
            title="位置を移動"
            description="囲んだ範囲の真ん中をドラッグして位置を移動できます"
          />
          <StepItem
            number={4}
            title="自動で保存"
            description="設定は自動的に保存されます"
            isImportant
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Target className="h-5 w-5 text-blue-600" />}
          title="囲む場所の種類"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">必ず囲む場所</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">設問の解答欄</Badge>
                <Badge variant="outline">氏名欄</Badge>
                <Badge variant="outline">生徒番号欄</Badge>
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium">必要に応じて囲む場所</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">合計点欄</Badge>
                <Badge variant="secondary">小計欄</Badge>
              </div>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="覚えておくこと"
        >
          <div className="rounded-lg bg-blue-50 p-4">
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• 解答が書かれる範囲より少し大きめに囲みましょう</li>
              <li>• 問題文は囲まず、解答部分だけを囲みます</li>
              <li>• Deleteキーで選んだ範囲を削除できます</li>
            </ul>
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
              <strong>範囲を間違えた：</strong>
              間違えた範囲をクリックして選んでから、Deleteキーを押すと削除できます。
              もう一度正しい範囲をドラッグして囲み直してください。
            </TipItem>

            <TipItem type="warning">
              <strong>複数ページがある：</strong>
              上のページ選択ボタンでページを切り替えて、
              それぞれのページで採点範囲を囲んでください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>大きさの目安：</strong>
              生徒が書く文字や図が入りそうな大きさより、
              少し大きめに囲んでおくと安心です。
            </TipItem>

            <TipItem type="success">
              すべてのページで採点範囲を囲み終わると、 「次へ:
              採点領域の詳細情報設定」ボタンが表示されます。
              全部終わってから次に進みましょう。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
