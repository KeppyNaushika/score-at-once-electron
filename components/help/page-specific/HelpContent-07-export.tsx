"use client"

import { Download, FileSpreadsheet, FileText, Settings, CheckCircle, Lightbulb, Info, AlertTriangle } from "lucide-react"
import { HelpSection, StepItem, TipItem } from "../common/HelpComponents"

export function HelpContent07Export() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Download className="h-6 w-6 text-blue-600" />
          結果出力の使い方
        </h2>
        <p className="text-muted-foreground">
          採点完了後、PDF形式の採点済み答案とExcel形式の成績一覧を出力できます。
        </p>
      </div>

      <HelpSection
        icon={<Download className="h-5 w-5 text-green-600" />}
        title="基本的な出力手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="採点完了の確認"
            description="全生徒・全設問の採点が完了していることを確認"
          />
          <StepItem
            number={2}
            title="出力形式の選択"
            description="PDF（採点済み答案）またはExcel（成績一覧）を選択"
            isImportant
          />
          <StepItem
            number={3}
            title="設定の調整"
            description="採点マークの位置・サイズ・表示設定をカスタマイズ"
          />
          <StepItem
            number={4}
            title="出力実行"
            description="保存場所を選択して出力開始、進捗を確認"
          />
        </div>
      </HelpSection>

      <HelpSection
        icon={<FileText className="h-5 w-5 text-red-600" />}
        title="PDF出力（採点済み答案）"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-red-700">基本機能</h4>
            <div className="text-xs space-y-1">
              <p>• 元の答案画像に採点マークを重ね合わせて出力</p>
              <p>• 生徒別に個別PDFファイルを生成</p>
              <p>• 高品質な画像品質を維持</p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-red-700">採点マーク設定</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>正答マーク（○）</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                  <span>誤答マーク（×）</span>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                  <span>部分点マーク（△）</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>点数表示</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<FileSpreadsheet className="h-5 w-5 text-green-600" />}
        title="Excel出力（成績一覧）"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-green-700">出力内容</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="border-l-4 border-blue-500 pl-3">
                <h5 className="text-sm font-medium text-blue-700">点数一覧シート</h5>
                <div className="text-xs space-y-1">
                  <p>• 生徒別・設問別の獲得点数</p>
                  <p>• 自動計算された合計点・平均点</p>
                  <p>• 順位の自動算出</p>
                </div>
              </div>
              <div className="border-l-4 border-green-500 pl-3">
                <h5 className="text-sm font-medium text-green-700">正誤一覧シート</h5>
                <div className="text-xs space-y-1">
                  <p>• ○×△の正誤結果</p>
                  <p>• 設問別正答率の表示</p>
                  <p>• 難易度分析用データ</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <h4 className="text-xs font-medium text-green-800">Excel関数による動的計算</h4>
            <p className="text-xs text-green-700">
              SUM、AVERAGE、RANK関数により、後から点数を修正しても自動的に合計・順位が更新されます。
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-purple-600" />}
        title="採点マークの詳細設定"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium text-purple-700">位置設定（9位置）</h4>
            <div className="grid grid-cols-3 gap-1 text-xs">
              <div className="text-center border p-1">左上</div>
              <div className="text-center border p-1">中上</div>
              <div className="text-center border p-1">右上</div>
              <div className="text-center border p-1">左中</div>
              <div className="text-center border p-1 bg-blue-100">中央</div>
              <div className="text-center border p-1">右中</div>
              <div className="text-center border p-1">左下</div>
              <div className="text-center border p-1">中下</div>
              <div className="text-center border p-1">右下</div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-purple-700">サイズと表示設定</h4>
            <div className="text-xs space-y-1">
              <p>• <strong>サイズ調整:</strong> 小・中・大の3段階</p>
              <p>• <strong>透過設定:</strong> 背景が透ける透過マークと通常マーク</p>
              <p>• <strong>表示切替:</strong> マーク種別ごとの表示/非表示</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="出力プロセスの詳細"
      >
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">リアルタイム進捗表示</h4>
            <p className="text-xs text-muted-foreground">
              出力処理の進行状況をリアルタイムで確認できます。
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium">並行処理対応</h4>
            <p className="text-xs text-muted-foreground">
              保存場所の選択と出力処理を並行実行し、効率的に処理します。
            </p>
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h4 className="text-xs font-medium text-blue-800">高性能処理</h4>
            <p className="text-xs text-blue-700">
              別スレッドでの処理により、出力中でもアプリの操作性を維持します。
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な出力のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>事前確認:</strong>
            出力前に採点結果を確認し、未採点や点数の入力漏れがないかチェックしましょう。
          </TipItem>

          <TipItem type="info">
            <strong>採点マーク設定:</strong>
            透過マークは元の解答が見やすく、通常マークは採点結果が明確です。用途に応じて選択してください。
          </TipItem>

          <TipItem type="warning">
            <strong>ファイル保存:</strong>
            大量のファイルが生成されるため、専用フォルダを作成して整理することをお勧めします。
          </TipItem>
        </div>
      </HelpSection>

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="注意事項とトラブルシューティング"
      >
        <div className="space-y-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-700">
              <strong>容量不足:</strong> 大量のPDFファイル生成時は十分な空き容量を確保してください
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-700">
              <strong>見込受験者の扱い:</strong> 統計計算から除外されますが、個人記録PDFは出力されます
            </p>
          </div>
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
            <p className="text-xs text-yellow-700">
              <strong>出力時間:</strong> 生徒数・ページ数に応じて処理時間が変わります。進捗を確認しながらお待ちください
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="出力完了後の確認"
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-sm font-medium">出力完了チェックリスト</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div>□ 全生徒のPDFが生成</div>
              <div>□ 採点マークが正しく表示</div>
            </div>
            <div>
              <div>□ Excelファイルが作成</div>
              <div>□ 計算結果が正確</div>
            </div>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}