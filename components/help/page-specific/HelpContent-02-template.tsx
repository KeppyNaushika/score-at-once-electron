"use client"

import { Settings, Mouse, Lightbulb, Keyboard, Info, CheckCircle } from "lucide-react"
import { HelpSection, StepItem, TipItem, ShortcutItem } from "../common/HelpComponents"

export function HelpContent02Template() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
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

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Settings className="h-5 w-5 text-green-600" />}
        title="作成すべき領域の種類"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h4 className="font-medium text-green-700">必須領域</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-green-500"></div>
                <span>
                  <strong>設問領域:</strong> 各問題の解答部分
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                <span>
                  <strong>氏名欄:</strong> 学生の名前記入部分
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                <span>
                  <strong>学籍番号欄:</strong> 学生番号記入部分
                </span>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="font-medium text-orange-700">オプション領域</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                <span>
                  <strong>合計点欄:</strong> 総合得点記入部分
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-500"></div>
                <span>
                  <strong>小計欄:</strong> 部分点の合計
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-gray-500"></div>
                <span>
                  <strong>メモ欄:</strong> 採点者用メモ領域
                </span>
              </div>
            </div>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

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

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Keyboard className="h-5 w-5 text-indigo-600" />}
        title="キーボードショートカット"
      >
        <div className="space-y-2">
          <ShortcutItem
            keys="Ctrl + Z"
            description="直前の操作を取り消し（領域作成・移動・リサイズ）"
          />
          <ShortcutItem keys="Delete" description="選択中の領域を削除" />
          <ShortcutItem
            keys="↑↓←→"
            description="選択中の領域を1ピクセル単位で微調整"
          />
          <ShortcutItem
            keys="Shift + ↑↓←→"
            description="選択中の領域を10ピクセル単位で移動"
          />
          <ShortcutItem
            keys="Ctrl + S"
            description="現在の領域設定を手動保存"
          />
          <ShortcutItem keys="Esc" description="領域の選択を解除" />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<Info className="h-5 w-5 text-cyan-600" />}
        title="高度な機能と操作テクニック"
      >
        <div className="space-y-4">
          <div>
            <h4 className="mb-2 font-medium">精密な位置調整</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              領域を選択後、矢印キーで1ピクセル単位の精密な調整が可能です。
              Shiftキーと組み合わせると10ピクセル単位で素早く移動できます。
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-medium">複数領域の効率的な管理</h4>
            <p className="text-muted-foreground mb-2 text-sm">
              同じような問題が複数ある場合、最初の領域を正確に作成してから、
              その領域をコピー＆ペーストして位置だけ調整する方が効率的です。
            </p>
          </div>

          <div>
            <h4 className="mb-2 font-medium">自動保存機能</h4>
            <p className="text-muted-foreground text-sm">
              領域の作成・移動・リサイズは1秒後に自動保存されます。
              手動保存（Ctrl+S）も可能ですが、通常は自動保存で十分です。
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="次のステップへの準備"
      >
        <div className="space-y-3">
          <TipItem type="success">
            全ての必要な領域を作成完了したら、「次へ:
            領域情報を編集」ボタンが表示されます。
            各ページに最低限の設問領域が設定されていることを確認してから次に進みましょう。
          </TipItem>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <h4 className="mb-2 font-medium">確認チェックリスト</h4>
            <ul className="space-y-1 text-sm">
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