"use client"

import { Calendar, CheckCircle, Lightbulb, School, Users } from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContentClasses() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <School className="h-6 w-6 text-blue-600" />
          学級管理 - 使い方
        </h2>
        <p className="text-muted-foreground">
          ホームルーム、習熟度別、部活動など様々な学級を作成・管理しましょう。
        </p>
      </div>

      <HelpSection
        icon={<School className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="学級を作成"
            description="「新規作成」ボタンで学級名と種別を設定します"
          />
          <StepItem
            number={2}
            title="学級情報を入力"
            description="学級コード、説明文、在籍期間を設定します"
            isImportant
          />
          <StepItem
            number={3}
            title="生徒を追加"
            description="「生徒を追加」で学級に所属する生徒を登録します"
          />
          <StepItem
            number={4}
            title="情報を更新"
            description="在籍人数や期間は自動更新されます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Users className="h-5 w-5 text-blue-600" />}
          title="学級の種類"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">主な学級タイプ</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">ホームルーム</Badge>
                <Badge variant="outline">習熟度別</Badge>
                <Badge variant="outline">部活動</Badge>
                <Badge variant="outline">委員会</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                それぞれの学級で異なる生徒管理と プロジェクト運用が可能です。
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Calendar className="h-5 w-5 text-purple-600" />}
          title="期間管理"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">在籍期間の設定</h4>
              <div className="space-y-1 text-sm">
                <p>• 開始日：学級の開始時期</p>
                <p>• 終了日：学級の終了時期</p>
                <p>• 現在の在籍状況を自動判定</p>
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="text-sm text-purple-800">
                期間外の学級は一覧で区別表示されます。
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
              <strong>学級を削除したい：</strong>
              所属生徒がいる学級は削除不可です。先に生徒を他学級に移動してください。
            </TipItem>

            <TipItem type="warning">
              <strong>期間が過ぎた学級：</strong>
              終了日を過ぎた学級は「期間外」と表示されます。必要に応じて期間を延長してください。
            </TipItem>

            <TipItem type="info">
              <strong>学級コードの重複：</strong>
              同じ学級コードは使用不可です。一意の識別コードを設定してください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>学級コードの付け方：</strong>
              「3A」「数学習熟上位」「サッカー部」など分かりやすい略称を使いましょう。
            </TipItem>

            <TipItem type="success">
              <strong>効率的な管理：</strong>
              年度初めにまとめて学級を作成し、期間設定で適切に管理しましょう。
            </TipItem>

            <TipItem type="success">
              学級一覧では在籍人数が自動表示され、生徒の追加・削除で即座に更新されます。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
