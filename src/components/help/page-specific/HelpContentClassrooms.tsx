"use client"

import { CheckCircle, Eye, Lightbulb, School, Users } from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContentClassrooms() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <School className="h-6 w-6 text-blue-600" />
          学級管理
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
            description="「学級追加」ボタンで学級名を入力します（学級名は必須）"
          />
          <StepItem
            number={2}
            title="学級情報を入力"
            description="クラスコード・学年・説明を入力します（すべて任意）"
            isImportant
          />
          <StepItem
            number={3}
            title="生徒を追加"
            description="学級を開いて「生徒を追加」から所属する生徒を登録します"
          />
          <StepItem
            number={4}
            title="在籍人数を確認"
            description="所属する生徒の人数は一覧に自動で表示されます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<Users className="h-5 w-5 text-blue-600" />}
          title="いろいろな学級に使えます"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">学級名の例</h4>
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge variant="outline">ホームルーム</Badge>
                <Badge variant="outline">習熟度別</Badge>
                <Badge variant="outline">部活動</Badge>
                <Badge variant="outline">委員会</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                学級名は自由に付けられます。ホームルーム以外にも、
                習熟度別や部活動などの単位でまとめて作成できます。
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Eye className="h-5 w-5 text-purple-600" />}
          title="表示設定"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">表示・非表示の切り替え</h4>
              <div className="space-y-1 text-sm">
                <p>• 使わない学級は「非表示」にできます</p>
                <p>• 非表示の学級は一覧から隠せます</p>
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <p className="text-sm text-purple-800">
                非表示にした学級は、生徒一覧やインポートの選択肢に出てこなくなります。
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
              所属している生徒がいる学級は削除できません。先に生徒の所属を外してから削除してください。
            </TipItem>

            <TipItem type="warning">
              <strong>学級名が重複している：</strong>
              同じ学級名は使えません。学級名はそれぞれ別の名前にしてください。
            </TipItem>

            <TipItem type="info">
              <strong>使わない学級を隠したい：</strong>
              削除しなくても、表示設定で「非表示」にすれば一覧から隠せます。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>クラスコードの付け方：</strong>
              「3A」「M2」のような短い略称にすると、生徒の所属表示で見やすくなります。
            </TipItem>

            <TipItem type="success">
              <strong>効率的な管理：</strong>
              年度初めにまとめて学級を作成しておくと、生徒の登録や試験の準備がスムーズです。
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
