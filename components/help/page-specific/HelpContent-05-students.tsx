"use client"

import {
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"
import {
  CheckCircle,
  Info,
  Lightbulb,
  Settings,
  Upload,
  Users,
} from "lucide-react"

export function HelpContent05Students() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Users className="h-6 w-6 text-green-600" />
          受験生徒管理の使い方
        </h2>
        <p className="text-muted-foreground">
          このプロジェクトで採点する生徒を管理し、受験状態を設定します。
        </p>
      </div>

      <HelpSection
        icon={<Users className="h-5 w-5 text-blue-600" />}
        title="基本的な操作手順"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="生徒の追加"
            description="「学級から追加」または「生徒を追加」ボタンで生徒を登録"
          />
          <StepItem
            number={2}
            title="受験状態の設定"
            description="各生徒の受験状態（受験・見込・欠席）を選択"
            isImportant
          />
          <StepItem
            number={3}
            title="順序の調整"
            description="ドラッグ&ドロップで生徒の順序を変更（採点時の表示順）"
          />
          <StepItem
            number={4}
            title="不要な生徒の削除"
            description="チェックボックスで選択して一括削除も可能"
          />
        </div>
      </HelpSection>

      <HelpSection
        icon={<Info className="h-5 w-5 text-indigo-600" />}
        title="受験状態の説明"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="border-l-4 border-green-500 pl-3">
            <h4 className="text-sm font-medium text-green-700">受験</h4>
            <p className="text-muted-foreground text-xs">通常の受験者</p>
            <p className="text-xs text-green-600">
              • 答案照合の対象
              <br />• 採点作業の対象
              <br />• 成績集計に含む
            </p>
          </div>
          <div className="border-l-4 border-yellow-500 pl-3">
            <h4 className="text-sm font-medium text-yellow-700">見込</h4>
            <p className="text-muted-foreground text-xs">後日受験・追試</p>
            <p className="text-xs text-yellow-600">
              • 採点は実施
              <br />• 統計から除外
              <br />• 個人記録には反映
            </p>
          </div>
          <div className="border-l-4 border-red-500 pl-3">
            <h4 className="text-sm font-medium text-red-700">欠席</h4>
            <p className="text-muted-foreground text-xs">試験欠席者</p>
            <p className="text-xs text-red-600">
              • 答案照合対象外
              <br />• 採点対象外
              <br />• 欠席として記録
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
            <h4 className="text-sm font-medium text-purple-700">
              学級から追加
            </h4>
            <p className="text-muted-foreground mb-2 text-xs">
              既存の学級データから複数の生徒を一括で追加できます。
            </p>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
              <p className="text-xs text-purple-800">
                学級選択 → 生徒選択 → 一括追加
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-green-700">個別追加</h4>
            <p className="text-muted-foreground mb-2 text-xs">
              新しい生徒を個別に登録できます。
            </p>
            <div className="rounded-lg border border-green-200 bg-green-50 p-2">
              <p className="text-xs text-green-800">
                氏名・ふりがな・学籍番号が必須項目
              </p>
            </div>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Settings className="h-5 w-5 text-orange-600" />}
        title="一括操作機能"
      >
        <div className="space-y-2">
          <div className="text-sm">
            <p>
              <strong>複数選択:</strong> チェックボックスで対象の生徒を選択
            </p>
            <p>
              <strong>全選択:</strong> ヘッダーのチェックボックスで一括選択
            </p>
            <p>
              <strong>一括削除:</strong> 選択した生徒をまとめて削除
            </p>
          </div>
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <p className="text-xs text-orange-700">
              <strong>削除の注意:</strong>{" "}
              採点データがある生徒を削除する場合、影響範囲が表示されます。
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        icon={<Lightbulb className="h-5 w-5 text-yellow-600" />}
        title="管理のコツ"
      >
        <div className="space-y-3">
          <TipItem type="success">
            <strong>事前準備:</strong>
            欠席が確定している生徒は事前に「欠席」に設定しておくと、答案アップロード時のエラーを防げます。
          </TipItem>

          <TipItem type="info">
            <strong>順序管理:</strong>
            生徒の順序は採点時の表示順になります。出席番号順や五十音順など、分かりやすい順序にしておきましょう。
          </TipItem>
        </div>
      </HelpSection>

      <HelpSection
        icon={<CheckCircle className="h-5 w-5 text-green-600" />}
        title="完了前のチェック"
      >
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-sm font-medium">
            生徒管理完了チェックリスト
          </h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div>□ 全受験生徒を登録</div>
              <div>□ 受験状態を適切に設定</div>
            </div>
            <div>
              <div>□ 欠席者を「欠席」に設定</div>
              <div>□ 生徒順序を確認</div>
            </div>
          </div>
        </div>
      </HelpSection>
    </div>
  )
}
