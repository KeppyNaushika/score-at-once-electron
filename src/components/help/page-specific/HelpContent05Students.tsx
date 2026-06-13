"use client"

import { CheckCircle, Info, Lightbulb, Upload, Users } from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContent05Students() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Users className="h-6 w-6 text-blue-600" />
          受験生徒の管理 - 使い方
        </h2>
        <p className="text-muted-foreground">
          採点する生徒を登録して、受験状態を設定しましょう。
        </p>
      </div>

      <HelpSection
        icon={<Users className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="生徒を追加"
            description="「生徒を追加」ボタンで生徒を登録します"
          />
          <StepItem
            number={2}
            title="受験状態を決める"
            description="各生徒が「受験」「見込」「欠席」のどれかを選ぶ"
            isImportant
          />
          <StepItem
            number={3}
            title="順番を整える"
            description="ドラッグして採点時の表示順を決める"
          />
          <StepItem
            number={4}
            title="不要な生徒を削除"
            description="チェックして「選択した生徒を削除」ボタンを押す"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Info className="h-5 w-5 text-blue-600" />}
          title="受験状態について"
        >
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-3">
              <h4 className="text-sm font-medium text-green-700">受験</h4>
              <p className="text-xs text-green-600">
                答案の採点対象となる生徒。点数が成績に反映されます。
              </p>
            </div>
            <div className="border-l-4 border-yellow-500 pl-3">
              <h4 className="text-sm font-medium text-yellow-700">見込</h4>
              <p className="text-xs text-yellow-600">
                暫定的な登録の生徒。採点はするが平均点計算からは除外されます。
              </p>
            </div>
            <div className="border-l-4 border-red-500 pl-3">
              <h4 className="text-sm font-medium text-red-700">欠席</h4>
              <p className="text-xs text-red-600">
                答案なしで0点として集計される生徒。採点作業からは除外されます。
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Upload className="h-5 w-5 text-purple-600" />}
          title="生徒の追加方法"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">追加の方法</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">学級から選んで追加</Badge>
                <Badge variant="outline">個別に新規追加</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-purple-800">
                学級から追加すると、複数の生徒をまとめて登録できて便利です。
              </p>
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
            <TipItem type="info">
              <strong>まとめて生徒を登録したい：</strong>
              「生徒を追加」→「学級から追加」で、
              学級を選んで複数の生徒を一度に追加できます。
            </TipItem>

            <TipItem type="warning">
              <strong>欠席者がいる：</strong>
              欠席が分かっている生徒は先に「欠席」に設定しておくと、
              答案アップロード時にエラーが出ません。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>順番を変えたい：</strong>
              生徒の行をマウスでドラッグすれば順番を変えられます。
              この順番が採点時の表示順になります。
            </TipItem>

            <TipItem type="success">
              複数の生徒を削除したいときは、チェックボックスで選んでから
              「選択した生徒を削除」ボタンを押してください。
              採点データがある生徒を削除する場合は影響範囲が表示されます。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
