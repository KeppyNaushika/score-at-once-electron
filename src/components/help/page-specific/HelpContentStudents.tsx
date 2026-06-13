"use client"

import {
  CheckCircle,
  Filter,
  Lightbulb,
  Trash2,
  UploadCloud,
  Users,
} from "lucide-react"

import {
  Badge,
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"

export function HelpContentStudents() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
          <Users className="h-6 w-6 text-blue-600" />
          生徒管理
        </h2>
        <p className="text-muted-foreground">
          学校全体の生徒を登録・管理します。ここで登録した生徒は、学級や試験で呼び出して使えます。
        </p>
      </div>

      <HelpSection
        icon={<Users className="h-5 w-5 text-green-600" />}
        title="基本の使い方"
      >
        <div className="space-y-3">
          <StepItem
            number={1}
            title="生徒を追加"
            description="「生徒追加」ボタンで1人ずつ登録します"
          />
          <StepItem
            number={2}
            title="まとめて追加"
            description="「Excel 貼付一括追加」で、表計算ソフトからコピーして一度に登録できます"
            isImportant
          />
          <StepItem
            number={3}
            title="学級に所属させる"
            description="生徒を学級に所属させると、試験で学級ごとにまとめて追加できます"
          />
          <StepItem
            number={4}
            title="探す・絞り込む"
            description="名前や学籍番号で検索したり、学級・所属状況で絞り込めます"
          />
        </div>
      </HelpSection>

      <div className="my-4 border-t border-gray-200" />

      <div className="grid gap-6 lg:grid-cols-2">
        <HelpSection
          icon={<UploadCloud className="h-5 w-5 text-purple-600" />}
          title="追加・読み込みの方法"
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">生徒追加</Badge>
              <Badge variant="outline">Excel 貼付一括追加</Badge>
              <Badge variant="outline">.students 読み込み</Badge>
            </div>
            <div className="rounded-lg bg-purple-50 p-4">
              <p className="text-sm text-purple-800">
                大人数を登録するときは「Excel 貼付一括追加」が便利です。
                別の端末で作った生徒データは「.students
                読み込み」で取り込めます。
              </p>
            </div>
          </div>
        </HelpSection>

        <HelpSection
          icon={<Filter className="h-5 w-5 text-blue-600" />}
          title="絞り込みと検索"
        >
          <div className="space-y-3">
            <div>
              <h4 className="mb-2 font-medium">所属状況で絞り込む</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">現在所属中</Badge>
                <Badge variant="secondary">過去の所属</Badge>
                <Badge variant="secondary">未所属</Badge>
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                学級フィルタや、生徒名・学籍番号での検索と組み合わせて、
                目的の生徒をすばやく見つけられます。
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
              <strong>学級に追加されない：</strong>
              この画面は学校全体の生徒台帳です。学級への所属は、
              各学級の画面で「生徒を追加」から設定します。
            </TipItem>

            <TipItem type="warning">
              <strong>生徒を削除したい：</strong>
              <span className="inline-flex items-center gap-1">
                各行の
                <Trash2 className="inline h-3 w-3" />
                アイコン
              </span>
              で削除できます。試験の採点データがある生徒は、削除すると関連データにも影響するため注意してください。
            </TipItem>
          </div>
        </HelpSection>

        <HelpSection
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          title="操作のコツ"
        >
          <div className="space-y-3">
            <TipItem type="success">
              <strong>書き出して共有：</strong>
              生徒を選んでから「Excel出力」や「.students 書き出し」で、
              一覧や生徒データを外部に保存できます。
            </TipItem>

            <TipItem type="success">
              年度初めに生徒をまとめて登録し、学級へ所属させておくと、
              試験ごとの受験生徒の追加がスムーズになります。
            </TipItem>
          </div>
        </HelpSection>
      </div>
    </div>
  )
}
