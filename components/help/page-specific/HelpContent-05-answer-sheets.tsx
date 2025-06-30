"use client"

import { Upload, Info, Settings, FileImage, CheckCircle, Lightbulb, AlertTriangle } from "lucide-react"
import { HelpSection, StepItem, TipItem } from "../common/HelpComponents"

export function HelpContent05AnswerSheets() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Upload className="h-6 w-6 text-blue-600" />
          答案アップロードの使い方
        </h2>
        <p className="text-muted-foreground">
          生徒の答案画像をアップロードし、表形式で生徒と答案の対応付けを行います。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本的なアップロード手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="ファイル選択"
            description="「新規追加」タブで答案画像（PNG、JPEG、PDF）をドラッグ&ドロップ"
          />
          <StepItem
            number={2}
            title="配置戦略選択"
            description="「ページごと並べる」または「生徒ごと並べる」を選択"
            isImportant
          />
          <StepItem
            number={3}
            title="グリッドで確認"
            description="生徒×ページの表で答案の配置を確認・調整"
          />
          <StepItem
            number={4}
            title="アップロード実行"
            description="「アップロード」ボタンでデータベースに保存"
          />
        </div>
      </HelpSection>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-purple-600" />}
        title="配置戦略の選択"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="border-l-4 border-green-500 pl-3">
            <h4 className="text-sm font-medium text-green-700">ページごと並べる</h4>
            <p className="text-xs text-muted-foreground mb-1">1ページ目全員 → 2ページ目全員の順</p>
            <p className="text-xs text-green-600">ページ別にスキャンした場合に適している</p>
          </div>
          <div className="border-l-4 border-blue-500 pl-3">
            <h4 className="text-sm font-medium text-blue-700">生徒ごと並べる</h4>
            <p className="text-xs text-muted-foreground mb-1">生徒A全ページ → 生徒B全ページの順</p>
            <p className="text-xs text-blue-600">生徒別にスキャンした場合に適している</p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<FileImage className="h-5 w-5 text-indigo-600" />}
        title="表形式の管理機能"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">基本操作</h4>
            <div className="text-xs space-y-1">
              <p>• <strong>ドラッグ&ドロップ:</strong> 画像を別のセルに移動</p>
              <p>• <strong>Alt+クリック:</strong> セルを無効化（配置対象外）</p>
              <p>• <strong>画像削除:</strong> セル右上の×ボタンで画像削除</p>
              <p>• <strong>プレビュー切替:</strong> 全体表示と氏名欄表示を切替</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">セルの状態</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>配置済み（画像あり）</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-gray-500"></div>
                  <span>空き（配置可能）</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span>生徒無効（欠席等）</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span>セル無効（除外）</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="タブの使い分け"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-green-700">新規追加タブ</h4>
            <div className="text-xs space-y-1">
              <p>• 新しい答案画像のアップロード</p>
              <p>• 配置戦略の選択と自動配置</p>
              <p>• 一括アップロード実行</p>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-orange-700">現在の対応状況タブ</h4>
            <div className="text-xs space-y-1">
              <p>• アップロード済み答案の確認</p>
              <p>• 個別の画像削除・移動</p>
              <p>• 対応状況の最終確認</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な管理のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>スキャン方法に応じた戦略選択:</strong>
            ページ別にスキャンした場合は「ページごと並べる」、生徒別にスキャンした場合は「生徒ごと並べる」を選択すると自動配置が正確になります。
          </TipItem>

          <TipItem type="info">
            <strong>プレビュー機能の活用:</strong>
            氏名欄表示で生徒の特定、全体表示で答案内容の確認ができます。用途に応じて切り替えると効率的です。
          </TipItem>
        </div>
      </HelpSection>

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある問題と対処法"
      >
        <div className="space-y-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              <strong>画像が表示されない:</strong> ファイルパスや権限を確認してください
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-700">
              <strong>自動配置が期待通りにならない:</strong> 配置戦略の選択を確認し、必要に応じて手動調整してください
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="完了前のチェック"
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-sm font-medium">答案管理完了チェックリスト</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div>□ 全受験者の答案を配置</div>
              <div>□ 画像が正常に表示</div>
            </div>
            <div>
              <div>□ 欠席者セルを無効化</div>
              <div>□ アップロード処理完了</div>
            </div>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}