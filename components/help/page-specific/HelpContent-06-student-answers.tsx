"use client"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"
import { CheckCircle, FileImage, Info, Lightbulb, Upload } from "lucide-react"

export function HelpContent06StudentAnswers() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Upload className="h-6 w-6 text-blue-600" />
          生徒答案の追加と関連付け - 使い方
        </h2>
        <p className="text-muted-foreground">
          生徒の答案画像をアップロードして、それぞれの生徒に正しく関連付けましょう。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="答案を選ぶ"
            description="「新規追加」タブで答案画像ファイルをドラッグするか選択"
          />
          <StepItem
            number={2}
            title="並べ方を決める"
            description="「ページごと」か「生徒ごと」かを選んでください"
            isImportant
          />
          <StepItem
            number={3}
            title="表で確認"
            description="生徒と答案が正しく対応しているかチェック"
          />
          <StepItem
            number={4}
            title="アップロード"
            description="「アップロード」ボタンを押して保存"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FileImage className="h-5 w-5 text-blue-600" />}
          title="使えるファイルの種類"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">対応ファイル</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">PDF</Badge>
                <Badge variant="outline">PNG</Badge>
                <Badge variant="outline">JPEG/JPG</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                PDFファイルは自動的にページごとの画像に変換されます。
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Info className="h-5 w-5 text-purple-600" />}
          title="並べ方の選び方"
        >
          <div className="space-y-3">
            <div className="border-l-4 border-green-500 pl-3">
              <h4 className="text-sm font-medium text-green-700">
                ページごと並べる
              </h4>
              <p className="text-xs text-green-600">
                1ページ目をまとめて、次に2ページ目をまとめてスキャンした場合
              </p>
            </div>
            <div className="border-l-4 border-blue-500 pl-3">
              <h4 className="text-sm font-medium text-blue-700">
                生徒ごと並べる
              </h4>
              <p className="text-xs text-blue-600">
                生徒Aの全ページ、次に生徒Bの全ページという順でスキャンした場合
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
              <strong>答案の位置を間違えた：</strong>
              「配置済み答案の確認」タブで、画像をドラッグして正しい位置に移動できます。
              変更したら「○件の変更を反映」ボタンを押してください。
            </TipItem>

            <TipItem type="warning">
              <strong>自動配置がうまくいかない：</strong>
              スキャンした順番に合わせて「ページごと」か「生徒ごと」を選び直してください。
              それでもダメなら手動で調整しましょう。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>2つのタブを使い分ける：</strong>
              新しく答案を追加するときは「新規追加」、
              すでにアップロードした答案を確認・修正するときは「配置済み答案の確認」を使います。
            </TipItem>

            <TipItem type="success">
              答案を移動するときは、採点情報も一緒に移動することをお勧めします。
              答案と採点結果がずれてしまうのを防げます。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
