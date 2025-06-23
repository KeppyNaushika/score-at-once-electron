"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { 
  FileImage, 
  Mouse, 
  Upload, 
  Settings, 
  Users, 
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Info,
  Lightbulb,
  Keyboard
} from "lucide-react"

interface HelpSectionProps {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
  className?: string
}

function HelpSection({ icon, title, children, className = "" }: HelpSectionProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-base">{title}</h3>
      </div>
      <div className="space-y-2 pl-7">
        {children}
      </div>
    </div>
  )
}

interface StepItemProps {
  number: number
  title: string
  description: string
  isImportant?: boolean
}

function StepItem({ number, title, description, isImportant = false }: StepItemProps) {
  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
        isImportant ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
      }`}>
        {number}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

interface TipItemProps {
  children: React.ReactNode
  type?: "info" | "warning" | "success"
}

function TipItem({ children, type = "info" }: TipItemProps) {
  const styles = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-orange-50 border-orange-200 text-orange-800", 
    success: "bg-green-50 border-green-200 text-green-800"
  }
  
  return (
    <div className={`border rounded-lg p-3 text-sm ${styles[type]}`}>
      {children}
    </div>
  )
}

interface ShortcutItemProps {
  keys: string
  description: string
}

function ShortcutItem({ keys, description }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <kbd className="rounded border bg-gray-100 px-2 py-1 font-mono text-xs font-semibold">
        {keys}
      </kbd>
      <span className="ml-3 flex-1 text-sm text-muted-foreground">
        {description}
      </span>
    </div>
  )
}

// 01-upload ページ用
export function UploadHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
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

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-purple-600" />}
        title="サポートファイル形式と推奨設定"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2">対応形式</h4>
            <div className="space-y-1">
              <Badge variant="outline">PDF</Badge>
              <Badge variant="outline">PNG</Badge>
              <Badge variant="outline">JPEG/JPG</Badge>
              <Badge variant="outline">TIFF</Badge>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">推奨品質</h4>
            <ul className="text-sm space-y-1">
              <li>• 解像度: 300DPI以上</li>
              <li>• サイズ: A4相当</li>
              <li>• 向き: 統一されていること</li>
              <li>• 明度: 適切なコントラスト</li>
            </ul>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

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

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Mouse className="h-5 w-5 text-indigo-600" />}
        title="操作方法詳細"
      >
        <div className="space-y-2">
          <h4 className="font-medium">ページ順序の変更</h4>
          <p className="text-sm text-muted-foreground mb-3">
            アップロード後、ページサムネイルをマウスでドラッグして順序を変更できます。
            正しい試験問題の順序に並び替えてから次のステップに進んでください。
          </p>
          
          <h4 className="font-medium">ページの削除</h4>
          <p className="text-sm text-muted-foreground">
            不要なページは各ページの右上にある「×」ボタンで削除できます。
            誤って削除した場合は、再度アップロードしてください。
          </p>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップの準備"
      >
        <TipItem type="success">
          模範解答のアップロードが完了したら、「次へ: 採点領域作成」ボタンが表示されます。
          全てのページが正しい順序で表示されていることを確認してから次に進みましょう。
        </TipItem>
      </HelpSection>
    </div>
  )
}

// 02-template ページ用
export function TemplateHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-6 w-6 text-purple-600" />
          採点領域作成 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          模範解答上に採点対象となる領域を視覚的に定義します。正確な領域設定が効率的な採点の鍵となります。
        </p>
      </div>

      <HelpSection
        icon={<Mouse className="h-5 w-5 text-blue-600" />}
        title="基本的な領域作成手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="作成開始"
            description="模範解答画像上でマウスの左ボタンを押してドラッグを開始"
          />
          <StepItem
            number={2}
            title="領域をドラッグ"
            description="採点したい範囲を囲むように対角線方向にドラッグします"
          />
          <StepItem
            number={3}
            title="領域確定"
            description="マウスボタンを放すと採点領域が作成されます"
          />
          <StepItem
            number={4}
            title="微調整"
            description="四隅のハンドルをドラッグしてサイズ調整、中央をドラッグして移動"
            isImportant
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-green-600" />}
        title="作成すべき領域の種類"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-green-700">必須領域</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span><strong>設問領域:</strong> 各問題の解答部分</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span><strong>氏名欄:</strong> 学生の名前記入部分</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span><strong>学籍番号欄:</strong> 学生番号記入部分</span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-orange-700">オプション領域</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span><strong>合計点欄:</strong> 総合得点記入部分</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span><strong>小計欄:</strong> 部分点の合計</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span><strong>メモ欄:</strong> 採点者用メモ領域</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効果的な領域設定のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>設問領域のサイズ設定:</strong> 
            生徒の手書き文字がはみ出すことを考慮して、実際の解答範囲より15-20%大きめに設定します。
            特に数式や図が含まれる問題では余裕を持たせることが重要です。
          </TipItem>
          
          <TipItem type="info">
            <strong>複数ページの効率的な処理:</strong>
            ページ選択ボタンで各ページに移動し、ページごとに適切な領域を設定します。
            前のページで作成した領域は自動保存されるので、安心してページを切り替えられます。
          </TipItem>
          
          <TipItem type="warning">
            <strong>よくある設定ミス:</strong>
            設問番号や問題文を領域に含めないよう注意してください。採点領域は「解答部分のみ」に限定します。
            また、複数の小問がある場合は、可能な限り小問ごとに個別の領域を作成することをお勧めします。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="キーボードショートカット"
      >
        <div className="space-y-2">
          <ShortcutItem keys="Ctrl + Z" description="直前の操作を取り消し（領域作成・移動・リサイズ）" />
          <ShortcutItem keys="Delete" description="選択中の領域を削除" />
          <ShortcutItem keys="↑↓←→" description="選択中の領域を1ピクセル単位で微調整" />
          <ShortcutItem keys="Shift + ↑↓←→" description="選択中の領域を10ピクセル単位で移動" />
          <ShortcutItem keys="Ctrl + S" description="現在の領域設定を手動保存" />
          <ShortcutItem keys="Esc" description="領域の選択を解除" />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="高度な機能と操作テクニック"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">精密な位置調整</h4>
            <p className="text-sm text-muted-foreground mb-2">
              領域を選択後、矢印キーで1ピクセル単位の精密な調整が可能です。
              Shiftキーと組み合わせると10ピクセル単位で素早く移動できます。
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">複数領域の効率的な管理</h4>
            <p className="text-sm text-muted-foreground mb-2">
              同じような問題が複数ある場合、最初の領域を正確に作成してから、
              その領域をコピー＆ペーストして位置だけ調整する方が効率的です。
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">自動保存機能</h4>
            <p className="text-sm text-muted-foreground">
              領域の作成・移動・リサイズは1秒後に自動保存されます。
              手動保存（Ctrl+S）も可能ですが、通常は自動保存で十分です。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップへの準備"
      >
        <div className="space-y-3">
          <TipItem type="success">
            全ての必要な領域を作成完了したら、「次へ: 領域情報を編集」ボタンが表示されます。
            各ページに最低限の設問領域が設定されていることを確認してから次に進みましょう。
          </TipItem>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-2">確認チェックリスト</h4>
            <ul className="text-sm space-y-1">
              <li>✓ 全ての設問に対応する領域を作成</li>
              <li>✓ 氏名欄・学籍番号欄の領域を設定</li>
              <li>✓ 領域が解答範囲を適切にカバー</li>
              <li>✓ 重複する領域がない</li>
              <li>✓ 全ページの設定が完了</li>
            </ul>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}

// 03-region-info ページ用
export function RegionInfoHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Settings className="h-6 w-6 text-indigo-600" />
          領域情報編集 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          作成した採点領域に詳細な情報を設定します。正確な設定が効率的で正確な採点を可能にします。
        </p>
      </div>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-blue-600" />}
        title="基本的な編集手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="領域タイプ選択"
            description="ドロップダウンから適切な領域タイプ（設問、氏名欄、学籍番号欄など）を選択"
          />
          <StepItem
            number={2}
            title="設問番号入力"
            description="設問領域の場合、設問番号（例：1、2-1、3-a）を入力"
          />
          <StepItem
            number={3}
            title="配点設定"
            description="その設問の満点を数値で入力（例：10、5、2.5）"
            isImportant
          />
          <StepItem
            number={4}
            title="ラベル入力"
            description="採点時に表示される分かりやすい名前を入力"
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-green-600" />}
        title="領域タイプの詳細説明"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-medium text-green-700">採点対象領域</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-4 border-green-500 pl-3">
                <p><strong>設問 (QUESTION):</strong></p>
                <p className="text-muted-foreground">採点が必要な解答領域。設問番号と配点の設定が必須です。</p>
                <p className="text-xs text-green-600">例: 設問番号「1」、配点「10」、ラベル「問1 計算問題」</p>
              </div>
              
              <div className="border-l-4 border-blue-500 pl-3">
                <p><strong>小計 (SUBTOTAL):</strong></p>
                <p className="text-muted-foreground">複数設問の部分点合計を表示する領域。</p>
                <p className="text-xs text-blue-600">例: ラベル「第1部 小計」</p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-3">
                <p><strong>合計点 (TOTAL):</strong></p>
                <p className="text-muted-foreground">全体の合計点を表示する領域。</p>
                <p className="text-xs text-purple-600">例: ラベル「総合計点」</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <h4 className="font-medium text-orange-700">識別情報領域</h4>
            <div className="space-y-3 text-sm">
              <div className="border-l-4 border-orange-500 pl-3">
                <p><strong>氏名欄 (NAME):</strong></p>
                <p className="text-muted-foreground">学生の氏名が記入される領域。答案の照合に使用。</p>
                <p className="text-xs text-orange-600">例: ラベル「受験者氏名」</p>
              </div>
              
              <div className="border-l-4 border-red-500 pl-3">
                <p><strong>学籍番号欄 (STUDENT_ID):</strong></p>
                <p className="text-muted-foreground">学籍番号が記入される領域。自動照合の主要な手がかり。</p>
                <p className="text-xs text-red-600">例: ラベル「学籍番号」</p>
              </div>
              
              <div className="border-l-4 border-gray-500 pl-3">
                <p><strong>その他 (OTHER):</strong></p>
                <p className="text-muted-foreground">クラス名、受験番号など、その他の情報領域。</p>
                <p className="text-xs text-gray-600">例: ラベル「クラス名」</p>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効果的な設定のベストプラクティス"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>設問番号の命名規則:</strong> 
            一貫した命名規則を使用しましょう。例：「1」「2-1」「2-2」「3-a」「3-b」など。
            階層構造が分かりやすく、後の集計作業も効率的になります。
          </TipItem>
          
          <TipItem type="info">
            <strong>配点設定のコツ:</strong>
            小数点も使用可能です（例：2.5点、1.5点）。配点の合計が試験全体の満点と一致するか、
            設定完了後に必ず確認してください。不一致があると集計に問題が生じる可能性があります。
          </TipItem>
          
          <TipItem type="warning">
            <strong>ラベルの重要性:</strong>
            ラベルは採点時に表示される重要な情報です。採点者が迷わないよう、
            「問1 方程式」「問2-1 グラフ作成」のように内容が分かりやすい名前を付けましょう。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="効率的な編集操作"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">キーボードナビゲーション</h4>
            <div className="space-y-2">
              <ShortcutItem keys="Tab" description="次のフィールドに移動" />
              <ShortcutItem keys="Shift + Tab" description="前のフィールドに移動" />
              <ShortcutItem keys="Enter" description="編集を確定して次の行に移動" />
              <ShortcutItem keys="Esc" description="編集をキャンセル" />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">便利な編集機能</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>行のドラッグ:</strong> 行の左端をドラッグして順序を変更できます</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>自動保存:</strong> 変更は1秒後に自動的に保存されます</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <span><strong>一括入力:</strong> 同じタイプの領域は一度に設定できます</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある間違いと対処法"
      >
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">❌ 設問番号の重複</h4>
            <p className="text-sm text-red-700">
              同じ設問番号を複数の領域に設定すると、採点時に混乱が生じます。
              各設問番号は一意になるように設定してください。
            </p>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-800 mb-2">⚠️ 配点の設定漏れ</h4>
            <p className="text-sm text-orange-700">
              設問タイプの領域には必ず配点を設定してください。
              配点が0や空白の場合、その問題は採点対象から除外されます。
            </p>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">💡 ラベルの統一性</h4>
            <p className="text-sm text-yellow-700">
              同じような問題のラベルは統一感を持たせましょう。
              「問1」「問2」より「問1 計算」「問2 証明」の方が採点時に分かりやすくなります。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="設定完了前の最終チェック"
      >
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">✅ 設定完了チェックリスト</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>□ 全ての設問領域にタイプを設定</div>
                <div>□ 設問番号に重複がない</div>
                <div>□ 全ての設問に配点を設定</div>
                <div>□ 配点の合計が満点と一致</div>
              </div>
              <div className="space-y-1">
                <div>□ ラベルが分かりやすい</div>
                <div>□ 氏名欄・学籍番号欄を設定</div>
                <div>□ 領域の順序が適切</div>
                <div>□ 全ページの設定が完了</div>
              </div>
            </div>
          </div>
          
          <TipItem type="success">
            全ての領域情報の設定が完了したら、「次へ: 受験生徒管理」ボタンで次のステップに進みます。
            設定内容は自動保存されているので、いつでも戻って修正可能です。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 04-students ページ用
export function StudentsHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Users className="h-6 w-6 text-green-600" />
          受験生徒管理 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          このプロジェクトで採点する生徒を確認し、受験状態を適切に管理します。正確な生徒管理が効率的な採点作業の基盤となります。
        </p>
      </div>

      <HelpSection
        icon={<Users className="h-5 w-5 text-blue-600" />}
        title="受験状態の管理"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="受験状態の確認"
            description="各生徒の現在の受験状態（受験・見込・欠席）を確認します"
          />
          <StepItem
            number={2}
            title="状態の変更"
            description="ドロップダウンメニューから適切な受験状態を選択します"
            isImportant
          />
          <StepItem
            number={3}
            title="一括操作"
            description="複数の生徒を選択して一括で状態変更や削除を実行できます"
          />
          <StepItem
            number={4}
            title="生徒の追加"
            description="新しい生徒を個別に追加、またはExcelファイルから一括インポート"
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-indigo-600" />}
        title="受験状態の詳細説明"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-green-700 mb-2">受験 (participating)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              試験を受験し、答案の提出が期待される生徒です。
            </p>
            <div className="text-xs text-green-600">
              <p>• 答案アップロード時の照合対象</p>
              <p>• 採点作業の対象となる</p>
              <p>• 成績集計に含まれる</p>
            </div>
          </div>
          
          <div className="border-l-4 border-yellow-500 pl-4">
            <h4 className="font-medium text-yellow-700 mb-2">見込 (expected)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              当初欠席だったが、後日受験した生徒です。追試・再試験などが該当します。
            </p>
            <div className="text-xs text-yellow-600">
              <p>• 採点は通常通り実施される</p>
              <p>• 平均点等の統計計算からは除外</p>
              <p>• 個人の成績記録には反映される</p>
            </div>
          </div>
          
          <div className="border-l-4 border-red-500 pl-4">
            <h4 className="font-medium text-red-700 mb-2">欠席 (absent)</h4>
            <p className="text-sm text-muted-foreground mb-2">
              試験を欠席し、答案の提出がない生徒です。
            </p>
            <div className="text-xs text-red-600">
              <p>• 答案照合の対象外</p>
              <p>• 採点作業から除外</p>
              <p>• 欠席として記録される</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Upload className="h-5 w-5 text-purple-600" />}
        title="生徒の追加方法"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-purple-700 mb-2">個別追加</h4>
            <p className="text-sm text-muted-foreground mb-3">
              「生徒を追加」ボタンから、個別に生徒情報を入力して追加できます。
            </p>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <p className="text-sm text-purple-800">
                <strong>必須項目:</strong> 氏名、ふりがな、学籍番号<br/>
                <strong>オプション:</strong> 出席番号、入学年度
              </p>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-green-700 mb-2">Excel一括インポート</h4>
            <p className="text-sm text-muted-foreground mb-3">
              「生徒インポート」ボタンから、Excelファイルで複数の生徒を一括追加できます。
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800 mb-2"><strong>対応形式:</strong></p>
              <ul className="text-xs text-green-700 space-y-1">
                <li>• Excel (.xlsx, .xls) ファイル</li>
                <li>• CSV (.csv) ファイル</li>
                <li>• 1行目はヘッダー行として認識</li>
                <li>• 学籍番号列は必須</li>
              </ul>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な生徒管理のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>出席番号の活用:</strong> 
            出席番号を設定しておくと、生徒一覧が番号順に並び、管理が容易になります。
            また、答案アップロード時の照合精度も向上します。
          </TipItem>
          
          <TipItem type="info">
            <strong>学級単位での管理:</strong>
            複数の学級が対象の場合、学級ごとに表示が分かれています。
            学級ごとに受験状態を確認し、必要に応じて調整してください。
          </TipItem>
          
          <TipItem type="warning">
            <strong>欠席者の事前設定:</strong>
            事前に欠席が確定している生徒は「欠席」に設定しておくことで、
            答案アップロード時に「該当する生徒が見つからない」というエラーを防げます。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-orange-600" />}
        title="一括操作機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">複数選択操作</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>チェックボックス選択:</strong> 対象の生徒にチェックを入れて選択</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>全選択/全解除:</strong> ヘッダーのチェックボックスで一括選択</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <span><strong>一括削除:</strong> 選択した生徒をまとめて削除可能</span>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-800 mb-2">⚠️ 削除時の注意</h4>
            <p className="text-sm text-orange-700">
              生徒を削除する前に、その生徒に関連する採点データがあるかチェックされます。
              採点済みのデータがある場合は、影響範囲が表示されるので、慎重に判断してください。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップへの準備"
      >
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">✅ 生徒管理完了チェックリスト</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>□ 全ての受験生徒を登録</div>
                <div>□ 受験状態を適切に設定</div>
                <div>□ 出席番号を設定（推奨）</div>
                <div>□ 学籍番号の重複をチェック</div>
              </div>
              <div className="space-y-1">
                <div>□ 欠席者を「欠席」に設定</div>
                <div>□ 後日受験済み生徒を「見込」に設定</div>
                <div>□ 氏名・ふりがなを確認</div>
                <div>□ 不要な生徒を削除</div>
              </div>
            </div>
          </div>
          
          <TipItem type="success">
            生徒管理が完了したら、「次へ: 答案アップロード」ボタンで次のステップに進みます。
            生徒情報は後からでも変更できるので、必要に応じて戻って調整してください。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 05-answer-sheets ページ用
export function AnswerSheetsHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <Upload className="h-6 w-6 text-blue-600" />
          生徒解答アップロード - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          スキャンした生徒の答案画像をアップロードし、生徒情報との関連付けを正確に行います。自動照合機能で効率的な処理が可能です。
        </p>
      </div>

      <HelpSection
        icon={<Upload className="h-5 w-5 text-green-600" />}
        title="基本的なアップロード手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="ファイル準備"
            description="答案画像ファイル（PNG、JPEG、PDF）を準備します"
          />
          <StepItem
            number={2}
            title="ファイル名設定"
            description="「学籍番号_氏名.jpg」形式で命名すると自動認識精度が向上します"
            isImportant
          />
          <StepItem
            number={3}
            title="一括アップロード"
            description="複数ファイルをドラッグ&ドロップで一度に処理できます"
          />
          <StepItem
            number={4}
            title="生徒情報の確認・修正"
            description="自動認識結果を確認し、必要に応じて手動で修正します"
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-indigo-600" />}
        title="ファイル命名規則と自動認識"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-green-700 mb-3">推奨ファイル名形式</h4>
            <div className="space-y-2 text-sm">
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <p className="font-mono text-green-800">20240001_田中太郎.jpg</p>
                <p className="text-xs text-green-600">学籍番号_氏名.拡張子</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded p-2">
                <p className="font-mono text-blue-800">田中太郎_数学.pdf</p>
                <p className="text-xs text-blue-600">氏名_教科名.拡張子</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-2">
                <p className="font-mono text-purple-800">1_田中太郎.jpg</p>
                <p className="text-xs text-purple-600">出席番号_氏名.拡張子</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-orange-700 mb-3">自動認識の仕組み</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>学籍番号による照合:</strong> 最も確実な識別方法</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>氏名による照合:</strong> 漢字・ひらがな両方対応</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <span><strong>出席番号による照合:</strong> 数字からの識別</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                <span><strong>部分一致:</strong> 姓または名の一部でも認識</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<FileImage className="h-5 w-5 text-purple-600" />}
        title="答案状態の管理"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-l-4 border-green-500 pl-4">
            <h4 className="font-medium text-green-700 mb-2">関連付け済み</h4>
            <p className="text-sm text-muted-foreground mb-2">
              生徒情報と正しく関連付けられた答案です。
            </p>
            <div className="text-xs text-green-600">
              <p>• 採点作業の準備完了</p>
              <p>• 生徒名が表示される</p>
              <p>• 出席番号順で整理</p>
            </div>
          </div>
          
          <div className="border-l-4 border-yellow-500 pl-4">
            <h4 className="font-medium text-yellow-700 mb-2">未関連付け</h4>
            <p className="text-sm text-muted-foreground mb-2">
              自動認識できず、手動での関連付けが必要です。
            </p>
            <div className="text-xs text-yellow-600">
              <p>• 手動で生徒を選択</p>
              <p>• ファイル名を確認</p>
              <p>• 重複チェックあり</p>
            </div>
          </div>
          
          <div className="border-l-4 border-red-500 pl-4">
            <h4 className="font-medium text-red-700 mb-2">欠席扱い</h4>
            <p className="text-sm text-muted-foreground mb-2">
              答案が提出されていない生徒の状態です。
            </p>
            <div className="text-xs text-red-600">
              <p>• 欠席として記録</p>
              <p>• 採点対象外</p>
              <p>• 後から変更可能</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的なアップロードのコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>事前準備が重要:</strong> 
            スキャン時にファイル名を「学籍番号_氏名」形式にしておくと、
            アップロード時の自動認識率が大幅に向上し、手作業が削減されます。
          </TipItem>
          
          <TipItem type="info">
            <strong>画質とファイルサイズ:</strong>
            200DPI以上、ファイルサイズは1枚あたり2-5MB程度が最適です。
            高すぎると処理が重くなり、低すぎると文字が読みにくくなります。
          </TipItem>
          
          <TipItem type="warning">
            <strong>重複チェック機能:</strong>
            同じ生徒の答案を複数回アップロードした場合、システムが自動検出して警告を表示します。
            最新のファイルで上書きするか、別の生徒として処理するかを選択できます。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-orange-600" />}
        title="手動関連付けと修正操作"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">未関連付け答案の処理</h4>
            <div className="space-y-3">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800 mb-2"><strong>手動関連付け手順:</strong></p>
                <ol className="text-xs text-yellow-700 space-y-1">
                  <li>1. 「未関連付け」タブで対象ファイルを確認</li>
                  <li>2. ファイル名や画像内容から生徒を特定</li>
                  <li>3. 「生徒を選択」ドロップダウンから該当者を選択</li>
                  <li>4. 「関連付け」ボタンで確定</li>
                </ol>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">関連付け済み答案の修正</h4>
            <p className="text-sm text-muted-foreground mb-2">
              誤って関連付けられた答案は、「関連付け済み」タブで修正できます。
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>生徒変更:</strong> 異なる生徒に再関連付け</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                <span><strong>答案削除:</strong> 不要な答案ファイルを削除</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>欠席設定:</strong> 答案なしの場合は欠席に変更</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある問題と解決方法"
      >
        <div className="space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h4 className="font-medium text-red-800 mb-2">❌ 自動認識に失敗する場合</h4>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• ファイル名に余分な文字や記号が含まれている</li>
              <li>• 生徒情報（氏名・学籍番号）が登録されていない</li>
              <li>• ファイル名の文字化けや特殊文字の使用</li>
              <li>• 同姓同名の生徒が複数存在する</li>
            </ul>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-800 mb-2">⚠️ ファイルサイズが大きすぎる場合</h4>
            <p className="text-sm text-orange-700">
              1ファイルが10MBを超える場合、アップロードが失敗する可能性があります。
              画像編集ソフトでファイルサイズを削減するか、JPEG品質を調整してください。
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">💡 処理速度を向上させるコツ</h4>
            <p className="text-sm text-blue-700">
              大量の答案を処理する場合は、50枚程度ずつに分割してアップロードすると、
              システムの負荷が軽減され、より安定した処理が可能になります。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="採点開始前の最終確認"
      >
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">✅ アップロード完了チェックリスト</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>□ 全ての受験者の答案をアップロード</div>
                <div>□ 未関連付けファイルがゼロ</div>
                <div>□ 重複した答案がない</div>
                <div>□ ファイル形式が適切</div>
              </div>
              <div className="space-y-1">
                <div>□ 欠席者を「欠席」に設定</div>
                <div>□ 画像品質を目視確認</div>
                <div>□ 生徒名の表記が正確</div>
                <div>□ 答案の向きが統一</div>
              </div>
            </div>
          </div>
          
          <TipItem type="success">
            全ての答案アップロードが完了したら、「次へ: 採点開始」ボタンで採点作業に進みます。
            答案は後からでも追加・修正できるので、まずは主要な答案から処理を開始できます。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 06-score-at-once ページ用
export function ScoringHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-red-600" />
          採点作業 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          効率的な採点インターフェースで、キーボードショートカットを活用した高速採点が可能です。複数教員での協調採点にも対応しています。
        </p>
      </div>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-blue-600" />}
        title="基本的な採点手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="答案と設問の確認"
            description="表示された答案画像と採点対象の設問を確認します"
          />
          <StepItem
            number={2}
            title="点数入力"
            description="キーボードの数字キー（0-9）で直接点数を入力します"
            isImportant
          />
          <StepItem
            number={3}
            title="コメント追加（任意）"
            description="?キーを押してコメント入力モードに切り替え、詳細なフィードバックを追加"
          />
          <StepItem
            number={4}
            title="次の答案へ"
            description="Spaceキーまたは矢印キーで次の答案に進みます"
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="キーボードショートカット一覧"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-blue-700 mb-3">基本操作</h4>
            <div className="space-y-2">
              <ShortcutItem keys="0-9" description="点数を直接入力" />
              <ShortcutItem keys="Space" description="次の答案に進む" />
              <ShortcutItem keys="Backspace" description="前の答案に戻る" />
              <ShortcutItem keys="Enter" description="入力を確定して次へ" />
              <ShortcutItem keys="?" description="コメント入力モード" />
              <ShortcutItem keys="Esc" description="コメント入力を終了" />
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-green-700 mb-3">高度な操作</h4>
            <div className="space-y-2">
              <ShortcutItem keys="Ctrl + S" description="一時保存" />
              <ShortcutItem keys="Ctrl + Z" description="直前の採点を取り消し" />
              <ShortcutItem keys="F" description="満点を入力" />
              <ShortcutItem keys="X" description="0点を入力" />
              <ShortcutItem keys="H" description="配点の半分を入力" />
              <ShortcutItem keys="Tab" description="次の設問に移動" />
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Users className="h-5 w-5 text-purple-600" />}
        title="協調採点機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-purple-700 mb-2">複数教員での同時採点</h4>
            <p className="text-sm text-muted-foreground mb-3">
              複数の教員が同時に異なる設問を採点できます。リアルタイムで進捗が共有され、効率的な分業が可能です。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <h5 className="font-medium text-purple-800 mb-2">担当設問の分担例</h5>
                <ul className="text-xs text-purple-700 space-y-1">
                  <li>• A先生: 問1-3（計算問題）</li>
                  <li>• B先生: 問4-6（記述問題）</li>
                  <li>• C先生: 問7-9（証明問題）</li>
                </ul>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <h5 className="font-medium text-green-800 mb-2">進捗の可視化</h5>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>• リアルタイム進捗表示</li>
                  <li>• 設問別完了状況</li>
                  <li>• 教員別作業量の確認</li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <h4 className="font-medium text-orange-800 mb-2">⚠️ 競合回避システム</h4>
            <p className="text-sm text-orange-700">
              同じ答案を複数の教員が同時に採点しようとした場合、システムが自動的に検出して警告を表示します。
              先に採点を開始した教員が優先され、後から参加した教員には別の答案が割り当てられます。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-yellow-600" />}
        title="採点モードと表示設定"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-yellow-700 mb-2">表示モードの切り替え</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-l-4 border-blue-500 pl-3">
                <p><strong>設問拡大モード:</strong></p>
                <p className="text-sm text-muted-foreground">現在採点中の設問領域を拡大表示</p>
                <p className="text-xs text-blue-600">詳細な確認に最適</p>
              </div>
              <div className="border-l-4 border-green-500 pl-3">
                <p><strong>全体表示モード:</strong></p>
                <p className="text-sm text-muted-foreground">答案全体を表示して文脈を把握</p>
                <p className="text-xs text-green-600">記述問題の採点に有効</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-green-700 mb-2">ズーム・パン機能</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>マウスホイール:</strong> 答案画像のズームイン・アウト</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>ドラッグ操作:</strong> 拡大した画像の移動（パン）</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <span><strong>ダブルクリック:</strong> 元のサイズに戻す</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効率的な採点のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>キーボード中心の操作:</strong> 
            マウスをほとんど使わずにキーボードだけで採点を完了できます。
            数字キー、Space、Backspaceの3つのキーを覚えるだけで大幅に効率化されます。
          </TipItem>
          
          <TipItem type="info">
            <strong>部分点の活用:</strong>
            記述問題では小数点も入力可能です（例：2.5点、7.5点）。
            部分点を適切に付けることで、より正確で公平な評価が可能になります。
          </TipItem>
          
          <TipItem type="warning">
            <strong>採点基準の統一:</strong>
            複数教員で採点する場合は、事前に採点基準を明確にしておくことが重要です。
            特に記述問題や証明問題では、具体的な部分点の付け方を統一しましょう。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="採点データの管理"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">自動保存機能</h4>
            <p className="text-sm text-muted-foreground mb-2">
              採点データは入力と同時に自動保存されます。ネットワーク障害や予期しない終了があっても、
              最後に入力した点数まで確実に保存されています。
            </p>
          </div>
          
          <div>
            <h4 className="font-medium mb-2">採点履歴の確認</h4>
            <p className="text-sm text-muted-foreground mb-2">
              各答案の採点履歴が記録され、「いつ」「誰が」「何点付けたか」を後から確認できます。
              採点の透明性と品質管理に役立ちます。
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">💡 採点の修正</h4>
            <p className="text-sm text-blue-700">
              採点完了後でも点数の修正は可能です。一度採点した答案は「採点済み」として表示され、
              必要に応じて再採点や点数の調整ができます。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="採点完了と次のステップ"
      >
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">✅ 採点完了チェックリスト</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>□ 全ての受験者の採点が完了</div>
                <div>□ 未採点の設問がない</div>
                <div>□ 点数の入力漏れがない</div>
                <div>□ 部分点が適切に設定</div>
              </div>
              <div className="space-y-1">
                <div>□ コメントが必要な答案に記入</div>
                <div>□ 複数教員の採点が統一</div>
                <div>□ 特記事項の記録</div>
                <div>□ 最終確認が完了</div>
              </div>
            </div>
          </div>
          
          <TipItem type="success">
            全ての採点が完了したら、「次へ: 結果出力」ボタンで結果分析と出力のステップに進みます。
            採点データは自動的に集計され、Excel出力やPDF出力の準備が整います。
          </TipItem>
        </div>
      </HelpSection>
    </div>
  )
}

// 07-export ページ用
export function ExportHelpContent() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-green-600" />
          結果出力・分析 - 完全ガイド
        </h2>
        <p className="text-muted-foreground">
          採点結果の確認、詳細な分析、そして各種形式での出力を行います。多様な出力形式で教育現場のニーズに対応します。
        </p>
      </div>

      <HelpSection
        icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
        title="結果確認と基本分析"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="採点結果の概要確認"
            description="全体の採点状況、平均点、最高点・最低点などの基本統計を確認"
          />
          <StepItem
            number={2}
            title="設問別分析"
            description="各設問の正答率、部分点の分布、難易度の評価を確認"
            isImportant
          />
          <StepItem
            number={3}
            title="個人成績の確認"
            description="各生徒の詳細な得点状況と総合評価を確認"
          />
          <StepItem
            number={4}
            title="出力形式の選択"
            description="Excel、PDF、CSVなど、用途に応じた出力形式を選択"
          />
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<FileImage className="h-5 w-5 text-green-600" />}
        title="出力形式の詳細"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="border-l-4 border-green-500 pl-4">
              <h4 className="font-medium text-green-700 mb-2">Excel形式 (.xlsx)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                成績管理システムとの連携に最適な形式です。
              </p>
              <div className="text-xs text-green-600 space-y-1">
                <p>• 計算式付きテンプレート</p>
                <p>• 平均点・標準偏差の自動計算</p>
                <p>• グラフ・チャートの挿入</p>
                <p>• フィルタリング機能対応</p>
              </div>
            </div>
            
            <div className="border-l-4 border-blue-500 pl-4">
              <h4 className="font-medium text-blue-700 mb-2">PDF形式 (.pdf)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                印刷・配布用の公式文書として使用できます。
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <p>• 個人成績表（生徒・保護者用）</p>
                <p>• クラス別成績一覧</p>
                <p>• 設問別分析レポート</p>
                <p>• 印刷最適化レイアウト</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="border-l-4 border-purple-500 pl-4">
              <h4 className="font-medium text-purple-700 mb-2">CSV形式 (.csv)</h4>
              <p className="text-sm text-muted-foreground mb-2">
                他システムとのデータ連携に最適です。
              </p>
              <div className="text-xs text-purple-600 space-y-1">
                <p>• 軽量でシンプルなデータ形式</p>
                <p>• データベースインポート対応</p>
                <p>• プログラミング処理に適用</p>
                <p>• UTF-8エンコーディング</p>
              </div>
            </div>
            
            <div className="border-l-4 border-orange-500 pl-4">
              <h4 className="font-medium text-orange-700 mb-2">採点済み答案PDF</h4>
              <p className="text-sm text-muted-foreground mb-2">
                点数とコメントが記入された答案の出力です。
              </p>
              <div className="text-xs text-orange-600 space-y-1">
                <p>• 生徒への返却用</p>
                <p>• 保護者面談資料</p>
                <p>• 授業での解説資料</p>
                <p>• アーカイブ保存用</p>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-indigo-600" />}
        title="詳細分析機能"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-indigo-700 mb-2">統計分析レポート</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-center">
                <p className="font-medium text-blue-800">平均点</p>
                <p className="text-xs text-blue-600">クラス・設問別</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                <p className="font-medium text-green-800">標準偏差</p>
                <p className="text-xs text-green-600">ばらつき分析</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
                <p className="font-medium text-purple-800">正答率</p>
                <p className="text-xs text-purple-600">問題別傾向</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded p-2 text-center">
                <p className="font-medium text-orange-800">度数分布</p>
                <p className="text-xs text-orange-600">点数帯分析</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="font-medium text-green-700 mb-2">問題分析機能</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <span><strong>難易度分析:</strong> 正答率から問題の適切性を評価</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <span><strong>識別力分析:</strong> 上位者と下位者の正答率の差を計算</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <span><strong>部分点分析:</strong> 部分点の分布と傾向を可視化</span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="効果的な活用方法"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>教育現場での活用:</strong> 
            個人成績表PDFは生徒・保護者への説明資料として、Excel形式は成績処理システムへの
            インポート用として使い分けることで、効率的な成績管理が実現できます。
          </TipItem>
          
          <TipItem type="info">
            <strong>問題改善への活用:</strong>
            設問別の正答率や部分点分析結果を次回の問題作成に活かすことで、
            より適切な難易度と評価観点を持つ試験問題の作成が可能になります。
          </TipItem>
          
          <TipItem type="warning">
            <strong>データの保管と管理:</strong>
            出力したファイルには個人情報が含まれているため、適切なセキュリティ対策を講じて
            保管してください。不要になったファイルは確実に削除することを推奨します。
          </TipItem>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<Upload className="h-5 w-5 text-cyan-600" />}
        title="カスタム出力設定"
      >
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">出力項目のカスタマイズ</h4>
            <p className="text-sm text-muted-foreground mb-3">
              出力する項目や表示形式を詳細にカスタマイズできます。
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h5 className="font-medium text-cyan-700">含める情報</h5>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>学籍番号・氏名</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>設問別得点</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" defaultChecked />
                    <span>合計点・順位</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded" />
                    <span>採点コメント</span>
                  </label>
                </div>
              </div>
              <div className="space-y-2">
                <h5 className="font-medium text-cyan-700">表示形式</h5>
                <div className="space-y-1 text-xs">
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" className="rounded" defaultChecked />
                    <span>点数表示（例：8/10）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" className="rounded" />
                    <span>パーセント表示（例：80%）</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" name="format" className="rounded" />
                    <span>評定表示（例：A,B,C）</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="border-t border-gray-200 my-4" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="出力完了と保存"
      >
        <div className="space-y-3">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium mb-3">✅ 出力前チェックリスト</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <div>□ 採点データに漏れがない</div>
                <div>□ 出力形式を適切に選択</div>
                <div>□ 含める項目を確認</div>
                <div>□ ファイル名を適切に設定</div>
              </div>
              <div className="space-y-1">
                <div>□ 保存先フォルダを確認</div>
                <div>□ 既存ファイルの上書き確認</div>
                <div>□ 個人情報保護の確認</div>
                <div>□ バックアップの作成</div>
              </div>
            </div>
          </div>
          
          <TipItem type="success">
            出力が完了すると、指定したフォルダにファイルが保存されます。
            重要なデータは複数の場所にバックアップを作成することをお勧めします。
            また、プロジェクトデータはシステム内で保持されるため、後から再出力も可能です。
          </TipItem>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-800 mb-2">🎉 採点プロジェクト完了</h4>
            <p className="text-sm text-blue-700">
              お疲れさまでした！一括採点システムを使用した採点作業が完了しました。
              出力された結果を活用して、より良い教育活動にお役立てください。
            </p>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}