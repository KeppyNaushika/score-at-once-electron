"use client"

import {
  CheckCircle,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContent08Export() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Download className="h-6 w-6 text-blue-600" />
          採点結果のファイル出力 - 使い方
        </h2>
        <p className="text-muted-foreground">
          採点が完了したら、PDFファイルやExcelファイルで結果を保存しましょう。
        </p>
      </div>

      <HelpSection
        icon={<Download className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="生徒を選ぶ"
            description="左側で出力したい生徒にチェックを入れます"
          />
          <StepItem
            number={2}
            title="出力形式を選ぶ"
            description="右側のタブで「採点済み答案PDF」「採点データExcel」から選択"
            isImportant
          />
          <StepItem
            number={3}
            title="設定を調整"
            description="採点マークの表示方法や用紙の向きを設定します"
          />
          <StepItem
            number={4}
            title="ダウンロード"
            description="「ダウンロード」ボタンを押して保存場所を選択"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<FileText className="h-5 w-5 text-red-600" />}
          title="採点済み答案PDF"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">どんなファイル？</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">📄 元の答案</Badge>
                <Badge variant="outline">✓ 採点マーク</Badge>
                <Badge variant="outline">📝 得点</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                生徒の答案に採点結果を重ねて表示したPDFです。
                生徒に返却する時に便利です。
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-medium">設定できること</h4>
              <div className="space-y-1 text-sm">
                <p>• 用紙の向き（A4縦・A4横）</p>
                <p>• 採点マークの位置・大きさ</p>
                <p>• 透明マークか通常マークか</p>
              </div>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<FileSpreadsheet className="h-5 w-5 text-green-600" />}
          title="採点データExcel"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">どんなファイル？</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="secondary">📊 点数一覧</Badge>
                <Badge variant="secondary">✓ 正誤結果</Badge>
                <Badge variant="secondary">📈 集計データ</Badge>
              </div>
              <p className="text-muted-foreground text-sm">
                生徒の成績をまとめたExcelファイルです。
                成績管理や分析に使えます。
              </p>
            </div>
            <div>
              <h4 className="mb-2 font-medium">含まれるデータ</h4>
              <div className="space-y-1 text-sm">
                <p>• 設問別の得点と正誤</p>
                <p>• 合計点・平均点・順位</p>
                <p>• 自動計算式付き</p>
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
            <TipItem type="info">
              <strong>生徒を選択してください：</strong>
              左側で出力したい生徒にチェックしてからダウンロードしてください。
            </TipItem>

            <TipItem type="warning">
              <strong>警告が表示された場合：</strong>
              未採点の生徒がいると警告が出ます。続行か採点完了後出力か選択できます。
            </TipItem>

            <TipItem type="warning">
              <strong>出力に時間がかかる：</strong>
              生徒数が多いと処理時間が長くなります。進捗バーでお待ちください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>事前チェック：</strong>
              出力前に未採点の生徒がいないか確認。警告時は修正してから出力が安心です。
            </TipItem>

            <TipItem type="success">
              <strong>生徒の選び方：</strong>
              学級・受験状況で絞り込み、名前検索、「全て選択」で一括選択も可能です。
            </TipItem>

            <TipItem type="success">
              透明マークは答案が見やすく、通常マークは採点結果が明確です。用途に合わせて選択してください。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
