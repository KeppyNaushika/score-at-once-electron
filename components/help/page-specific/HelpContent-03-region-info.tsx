"use client"

import { Settings, Info, Lightbulb, Keyboard, CheckCircle, AlertTriangle } from "lucide-react"
import { HelpSection, StepItem, TipItem, ShortcutItem } from "../common/HelpComponents"

export function HelpContent03RegionInfo() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Settings className="h-6 w-6 text-indigo-600" />
          領域情報編集の使い方
        </h2>
        <p className="text-muted-foreground">
          作成した採点領域に設問番号や配点などの詳細情報を設定します。
        </p>
      </div>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-blue-600" />}
        title="基本的な編集手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="領域タイプを選択"
            description="ドロップダウンから適切なタイプ（設問、氏名欄など）を選択"
          />
          <StepItem
            number={2}
            title="設問番号を入力"
            description="設問の場合、「1」「2-1」「3-a」のような番号を入力"
          />
          <StepItem
            number={3}
            title="配点を設定"
            description="その設問の満点を数値で入力（例：10、5、2.5）"
            isImportant
          />
          <StepItem
            number={4}
            title="ラベルを入力"
            description="採点時に表示される分かりやすい名前を付ける"
          />
        </div>
      </HelpSection>

      <HelpSection
        icon={<Info className="h-5 w-5 text-green-600" />}
        title="領域タイプの説明"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <div className="border-l-4 border-green-500 pl-3">
              <p className="text-sm font-medium">設問 (QUESTION)</p>
              <p className="text-xs text-muted-foreground">採点が必要な解答領域</p>
            </div>
            <div className="border-l-4 border-orange-500 pl-3">
              <p className="text-sm font-medium">氏名欄 (NAME)</p>
              <p className="text-xs text-muted-foreground">学生の氏名記入部分</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="border-l-4 border-purple-500 pl-3">
              <p className="text-sm font-medium">合計点 (TOTAL)</p>
              <p className="text-xs text-muted-foreground">全体の合計点表示</p>
            </div>
            <div className="border-l-4 border-blue-500 pl-3">
              <p className="text-sm font-medium">小計 (SUBTOTAL)</p>
              <p className="text-xs text-muted-foreground">部分点の合計表示</p>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="キーボード操作"
      >
        <div className="space-y-2">
          <ShortcutItem keys="Tab" description="次のフィールドに移動" />
          <ShortcutItem keys="Enter" description="編集を確定して次の行へ" />
          <ShortcutItem keys="Esc" description="編集をキャンセル" />
        </div>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="設定のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>設問番号の付け方:</strong>
            一貫した命名規則を使いましょう。「1」「2-1」「2-2」「3-a」など。
          </TipItem>

          <TipItem type="info">
            <strong>配点設定:</strong>
            小数点も使えます（2.5点など）。合計が試験の満点と一致するか確認しましょう。
          </TipItem>

          <TipItem type="warning">
            <strong>ラベルの重要性:</strong>
            「問1 計算問題」のように内容が分かる名前を付けると採点時に便利です。
          </TipItem>
        </div>
      </HelpSection>

      <HelpSection
        icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
        title="よくある間違い"
      >
        <div className="space-y-2">
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-sm text-red-700">
              <strong>設問番号の重複:</strong> 同じ番号を複数の領域に付けないよう注意
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-sm text-orange-700">
              <strong>配点の設定漏れ:</strong> 設問タイプには必ず配点を設定してください
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="完了前のチェック"
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 font-medium">設定完了チェックリスト</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <div>□ 全設問にタイプ設定</div>
              <div>□ 設問番号に重複なし</div>
            </div>
            <div>
              <div>□ 全設問に配点設定</div>
              <div>□ ラベルが分かりやすい</div>
            </div>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}