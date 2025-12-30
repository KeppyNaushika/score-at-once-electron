"use client"

import {
  Badge,
  HelpSection,
  ShortcutItem,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"
import {
  CheckCircle,
  Edit,
  Keyboard,
  Lightbulb,
  Settings,
  Table,
} from "lucide-react"

export function HelpContent03RegionInfo() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Settings className="h-6 w-6 text-blue-600" />
          採点領域の詳細情報設定 - 使い方
        </h2>
        <p className="text-muted-foreground">
          採点する場所に設問番号や配点などの詳しい情報を設定しましょう。
        </p>
      </div>

      <HelpSection
        icon={<Edit className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="種類を選ぶ"
            description="表の「種類」で、その場所が何か（設問解答・氏名・生徒番号など）を選びます"
          />
          <StepItem
            number={2}
            title="ラベルを付ける"
            description="「問1 計算問題」のように、採点時に分かりやすい名前を付けます"
          />
          <StepItem
            number={3}
            title="配点を決める"
            description="設問解答の場合は、その問題の満点を入力します（例：10点、2.5点）"
            isImportant
          />
          <StepItem
            number={4}
            title="自動で保存"
            description="入力内容は自動的に保存されます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Table className="h-5 w-5 text-blue-600" />}
          title="領域の種類"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">採点が必要な場所</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">📋 設問解答</Badge>
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium">確認が必要な場所</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">📄 氏名</Badge>
                <Badge variant="secondary">🔢 生徒番号</Badge>
              </div>
            </div>
            <div>
              <h4 className="mb-2 font-medium">点数の表示場所</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">🏆 合計点</Badge>
                <Badge variant="secondary">🔢 小計</Badge>
              </div>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
          title="素早く移動する方法"
        >
          <div className="space-y-2">
            <ShortcutItem keys="Tab" description="同じ行の次の項目へ" />
            <ShortcutItem keys="Enter" description="次の行の同じ項目へ" />
            <ShortcutItem keys="Shift+Tab" description="同じ行の前の項目へ" />
            <ShortcutItem keys="Shift+Enter" description="前の行の同じ項目へ" />
          </div>
          <div className="mt-3 rounded-lg bg-blue-50 p-3">
            <p className="text-sm text-blue-800">
              行をドラッグして順序を変更することもできます
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
              <strong>配点を設定したい：</strong>
              種類が「設問解答」の行だけに配点を入力できます。
              他の種類では配点欄は使えません。
            </TipItem>

            <TipItem type="warning">
              <strong>領域が見つからない：</strong>
              前のステップ「採点領域作成」で採点する場所を囲んでから、
              このページに進んでください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>ラベルの付け方：</strong>
              「問1」「問2-1」「問3-a」のように、
              問題文と同じ番号を使うと分かりやすいです。
            </TipItem>

            <TipItem type="success">
              すべての設定が終わったら、「次へ:
              小計点の設定」ボタンが表示されます。
              配点に間違いがないか確認してから次に進みましょう。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
