"use client"

import { FileImage, Upload, Settings, Mouse, CheckCircle, Lightbulb } from "lucide-react"
import { HelpSection, StepItem, TipItem, Badge } from "../common/HelpComponents"

export function HelpContent01Upload() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <FileImage className="h-6 w-6 text-blue-600" />
          模範解答アップロード - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          試験問題の模範解答をアップロードして、採点の基準となる高品質な画像を準備します。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本的なアップロード手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="ファイルを準備"
            description="PDF、PNG、JPEG、TIFFファイルを用意します"
          />
          <StepItem
            number={2}
            title="ドラッグ&ドロップ"
            description="ファイルを画面にドラッグするか、「ファイルを選択」ボタンをクリック"
          />
          <StepItem
            number={3}
            title="自動変換"
            description="PDFは自動的にページ分割され、高品質PNG画像に変換されます"
          />
          <StepItem
            number={4}
            title="順序調整"
            description="ページをドラッグして正しい順序に並び替えます"
            isImportant
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-purple-600" />}
        title="サポートファイル形式と推奨設定"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="mb-2 font-medium">対応形式</h4>
            <div className="space-y-1">
              <Badge variant="outline">PDF</Badge>
              <Badge variant="outline">PNG</Badge>
              <Badge variant="outline">JPEG/JPG</Badge>
              <Badge variant="outline">TIFF</Badge>
            </div>
          </div>
          <div>
            <h4 className="mb-2 font-medium">推奨品質</h4>
            <ul className="space-y-1 text-sm">
              <li>• 解像度: 300DPI以上</li>
              <li>• サイズ: A4相当</li>
              <li>• 向き: 統一されていること</li>
              <li>• 明度: 適切なコントラスト</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="プロのヒント＆ベストプラクティス"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>高品質スキャンのコツ:</strong>
            スキャナーの設定は300DPI以上、カラーモードは「カラー」または「グレースケール」を選択。
            白い背景紙を使用して影やシワを避けましょう。
          </TipItem>

          <TipItem type="info">
            <strong>複数ページの効率的な処理:</strong>
            一度に複数のPDFファイルをアップロード可能です。
            ファイル名に「数学_第1回_問題1.pdf」のように内容を含めると管理が楽になります。
          </TipItem>

          <TipItem type="warning">
            <strong>よくある問題と対処法:</strong>
            画像が暗い場合は、スキャン時の明度調整またはスキャン後の画像編集ソフトで補正してください。
            斜めにスキャンされた場合は、再スキャンをお勧めします。
          </TipItem>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Mouse className="h-5 w-5 text-indigo-600" />}
        title="操作方法詳細"
      >
        <div className="space-y-2">
          <h4 className="font-medium">ページ順序の変更</h4>
          <p className="text-muted-foreground mb-3 text-sm">
            アップロード後、ページサムネイルをマウスでドラッグして順序を変更できます。
            正しい試験問題の順序に並び替えてから次のステップに進んでください。
          </p>

          <h4 className="font-medium">ページの削除</h4>
          <p className="text-muted-foreground text-sm">
            不要なページは各ページの右上にある「×」ボタンで削除できます。
            誤って削除した場合は、再度アップロードしてください。
          </p>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップの準備"
      >
        <TipItem type="success">
          模範解答のアップロードが完了したら、「次へ:
          採点領域作成」ボタンが表示されます。
          全てのページが正しい順序で表示されていることを確認してから次に進みましょう。
        </TipItem>
      </HelpSection>
    </div>
  )
}