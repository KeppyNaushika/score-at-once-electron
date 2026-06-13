"use client"

import { CheckCircle, FileImage, Lightbulb, Upload } from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContent01Upload() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <FileImage className="h-6 w-6 text-blue-600" />
          模範解答画像の管理
        </h2>
        <p className="text-muted-foreground">
          試験問題の模範解答をアップロードして、採点の準備をしましょう。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="ファイルを用意"
            description="PDF、PNG、JPEGファイルを準備します"
          />
          <StepItem
            number={2}
            title="ファイルを選ぶ"
            description="ファイルを画面にドラッグするか、「ファイルを選択」ボタンを押す"
          />
          <StepItem
            number={3}
            title="自動で変換"
            description="PDFは自動的にページごとの画像に変換されます"
          />
          <StepItem
            number={4}
            title="順番を整える"
            description="各ページの左右にある矢印ボタンで正しい順番に並び替える"
            isImportant
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
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="覚えておくこと"
        >
          <div className="rounded-lg bg-blue-50 p-4">
            <ul className="space-y-1 text-sm text-blue-800">
              <li>• 1つのファイルは最大50MBまで</li>
              <li>• 一度に最大20個のファイルまで</li>
              <li>• なるべく鮮明な画像を使いましょう</li>
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
              <strong>まとめてアップロードしたい：</strong>
              複数のファイルを選んで一度にアップロードできます。
              ファイル名に「数学_第1回_問題1.pdf」のように名前をつけると分かりやすいです。
            </TipItem>

            <TipItem type="warning">
              <strong>画像が見にくい：</strong>
              画像が暗すぎる場合は、スキャンし直すか、
              スマートフォンで明るい場所で撮影し直してください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>順番を間違えた：</strong>
              各ページの左右にある矢印ボタンで順番を変えられます。
              不要なページはゴミ箱アイコンで削除できます。
            </TipItem>

            <TipItem type="success">
              アップロードが終わったら、「次へ:
              答案の採点領域作成」ボタンが表示されます。
              全てのページが正しい順番になっていることを確認してから次に進みましょう。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
