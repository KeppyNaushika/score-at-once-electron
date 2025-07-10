"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import Head from "next/head"

// ワークフローステップの定義
const workflowSteps = [
  { id: "01-upload", label: "1. 模範解答", path: "01-upload" },
  { id: "02-template", label: "2. 採点領域", path: "02-template" },
  { id: "03-region-info", label: "3. 領域情報編集", path: "03-region-info" },
  { id: "03-2-question-group", label: "3-2. 設問グループ", path: "03-2-question-group" },
  { id: "04-students", label: "4. 受験生徒", path: "04-students" },
  { id: "05-answer-sheets", label: "5. 生徒解答", path: "05-answer-sheets" },
  { id: "06-score-at-once", label: "6. 採点", path: "06-score-at-once" },
  { id: "07-export", label: "7. 結果", path: "07-export" },
]


// 旧ページヒント情報（削除予定）
const pageHints: {
  [key: string]: {
    title: string
    description: string
    content: string[]
    tips?: string[]
    shortcuts?: { key: string; description: string }[]
  }
} = {
  "01-upload": {
    title: "模範解答のアップロード",
    description:
      "試験問題の模範解答をアップロードして、採点の基準となる画像を準備します。",
    content: [
      "PDFまたは画像ファイル（PNG、JPEG、TIFF）をアップロードできます",
      "PDFファイルは自動的にページごとに分割され、高品質なPNG画像として変換されます",
      "ドラッグ&ドロップでページの順序を自由に変更できます",
      "複数ファイルを同時にアップロードして、一括処理が可能です",
    ],
    tips: [
      "解像度の高いスキャン画像を使用すると、より正確な採点領域設定が可能です",
      "PDFの場合、A4サイズで300DPI以上の品質を推奨します",
      "ページ番号は後から変更できるので、順序を気にせずアップロードできます",
    ],
  },
  "02-template": {
    title: "採点領域の作成",
    description:
      "模範解答上に採点対象となる領域を視覚的に定義します。各設問や記入欄に対応する矩形領域を作成してください。",
    content: [
      "模範解答画像上でマウスをドラッグして採点領域を作成します",
      "設問領域、氏名欄、学籍番号欄、合計点欄など、すべての必要な領域を作成してください",
      "作成した領域は四隅のハンドルをドラッグしてサイズ変更、中央をドラッグして移動できます",
      "各ページごとに独立した採点領域を設定でき、複数ページの試験にも対応しています",
      "領域の作成は自動保存されるため、作業中にデータが失われる心配はありません",
    ],
    tips: [
      "設問領域は解答範囲より少し大きめに設定することで、手書きのはみ出しにも対応できます",
      "氏名欄や学籍番号欄を正確に設定することで、後の答案照合がスムーズになります",
      "複数の小問がある場合は、小問ごとに個別の領域を作成することをお勧めします",
    ],
    shortcuts: [
      { key: "Ctrl + Z", description: "直前の操作を取り消し" },
      { key: "Delete", description: "選択した領域を削除" },
      { key: "矢印キー", description: "選択した領域を微調整" },
    ],
  },
  "03-region-info": {
    title: "領域情報の編集",
    description:
      "作成した採点領域に詳細な情報を設定します。各領域の種類、配点、ラベルなどを正確に入力してください。",
    content: [
      "各領域の種類（設問、氏名欄、学籍番号欄など）を選択します",
      "設問領域には必ず設問番号と配点を設定してください",
      "表形式で一覧表示されるため、効率的な編集が可能です",
      "行をドラッグして領域の順序を変更できます",
      "すべての変更は自動的に保存されるため、手動保存の必要はありません",
    ],
    tips: [
      "設問番号は採点時の識別に使用されるため、重複しないよう注意してください",
      "配点の合計が試験の満点と一致するか確認しましょう",
      "ラベルは採点者にとって分かりやすい名前を付けることで、採点効率が向上します",
    ],
    shortcuts: [
      { key: "Tab", description: "次のフィールドに移動" },
      { key: "Shift + Tab", description: "前のフィールドに移動" },
      { key: "Enter", description: "編集を確定して次の行に移動" },
    ],
  },
  "03-2-question-group": {
    title: "設問グループ・小計点管理",
    description:
      "設問をグループ化して小計点を管理します。大問別や観点別の集計が可能になります。",
    content: [
      "設問グループ（大問、観点など）を作成し、グループ内の項目を定義します",
      "各設問をグループ項目に関連付けることで、小計点を自動計算します",
      "一つの設問を複数のグループに関連付けることができます",
      "小計点はExcel出力時に自動的に列として追加されます",
      "リアルタイムで小計点のプレビューを確認できます",
    ],
    tips: [
      "「大問1」「大問2」のような大問別グループが一般的です",
      "「知識・理解」「思考・判断」のような観点別グループも作成できます",
      "設問の関連付けを変更すると、小計点も自動で更新されます",
    ],
  },
  "04-students": {
    title: "受験生徒の確認・選択",
    description:
      "このプロジェクトで採点する生徒を確認し、必要に応じて受験者の選択を行います。",
    content: [
      "プロジェクトに登録されている全ての生徒が一覧表示されます",
      "受験する生徒と欠席者を明確に区別して管理できます",
      "生徒情報の追加や編集が必要な場合は、生徒管理画面で行います",
      "複数の学級が対象の場合、学級別に表示されます",
      "受験者の選択により、答案アップロード時の照合精度が向上します",
    ],
    tips: [
      "欠席が確定している生徒は事前に「欠席」に設定しておくと答案管理が効率的です",
      "転校生や途中参加の生徒がいる場合は、事前に生徒管理で追加してください",
      "学籍番号が正確に設定されていると、答案との自動照合がスムーズになります",
    ],
  },
  "05-answer-sheets": {
    title: "生徒解答のアップロード",
    description:
      "スキャンした生徒の答案画像をアップロードし、生徒情報との関連付けを行います。",
    content: [
      "生徒の答案画像をドラッグ&ドロップまたはファイル選択でアップロードします",
      "ファイル名に生徒名や学籍番号が含まれている場合、自動的に生徒を推測します",
      "複数ファイルを一度にアップロードして、効率的な作業が可能です",
      "アップロード後に生徒情報を手動で修正することもできます",
      "欠席者の管理機能により、提出されていない答案の把握が容易です",
    ],
    tips: [
      "ファイル名に「学籍番号_氏名」の形式で命名すると自動認識の精度が向上します",
      "スキャン時は模範解答と同じ向きで統一することを推奨します",
      "画像の解像度は200DPI以上を推奨（文字が鮮明に読める程度）",
    ],
  },
  "06-score-at-once": {
    title: "採点",
    description:
      "効率的な採点インターフェースで、キーボードショートカットを活用した高速採点が可能です。",
    content: [
      "キーボードショートカットで数値入力と画面遷移を効率的に行えます",
      "複数の教員が同時に異なる設問を採点できる協調採点機能",
      "部分点の入力やコメントの追加が可能です",
      "採点履歴の確認と修正機能により、正確な採点を支援します",
      "リアルタイムでの進捗確認と統計情報の表示",
    ],
    tips: [
      "数字キー（0-9）で直接点数を入力できます",
      "?キーで採点基準やコメント入力モードに切り替えられます",
      "複数教員で採点する場合は、事前に担当設問を決めておくとスムーズです",
    ],
    shortcuts: [
      { key: "0-9", description: "点数を直接入力" },
      { key: "Space", description: "次の答案に進む" },
      { key: "Backspace", description: "前の答案に戻る" },
      { key: "Enter", description: "入力を確定" },
      { key: "?", description: "コメント入力" },
      { key: "Ctrl + S", description: "一時保存" },
    ],
  },
  "07-export": {
    title: "結果",
    description: "採点結果の確認、分析、そして各種形式での出力を行います。",
    content: [
      "採点結果の一覧表示と詳細な統計分析",
      "Excel形式での成績一覧出力（関数付きテンプレート対応）",
      "個人成績表のPDF出力機能",
      "設問別・観点別の詳細分析レポート",
      "採点済み答案の一括PDF出力",
    ],
    tips: [
      "Excelテンプレートには平均点や標準偏差の計算式が含まれています",
      "個人成績表には間違えた問題のフィードバックを含めることができます",
      "結果データは後から再出力できるため、必要に応じて複数回出力可能です",
    ],
  },
}

export default function ProjectWorkflowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const projectId = params.projectId as string
  const [projectName, setProjectName] = useState<string>("")

  // プロジェクト情報を取得
  useEffect(() => {
    const loadProject = async () => {
      try {
        const project = await window.electronAPI.fetchProjectById(projectId)
        if (project) {
          setProjectName(project.examName)
        }
      } catch (error) {
        console.error("Error loading project:", error)
      }
    }
    loadProject()
  }, [projectId])

  return (
    <>
      <Head>
        <title>{projectName || "プロジェクト"} - 一括採点</title>
      </Head>
      <div className="flex h-full flex-col">
        <header className="bg-background flex items-center justify-between border-b px-4 py-3">
          <Breadcrumb>
            <BreadcrumbList>
              {workflowSteps.map((step, index) => {
                const isCurrentPage = pathname.includes(step.path)
                const linkHref = `/projects/${projectId}/${step.path}`

                return (
                  <React.Fragment key={step.id}>
                    <BreadcrumbItem>
                      {isCurrentPage ? (
                        <BreadcrumbPage className="font-semibold text-green-600">
                          {step.label}
                        </BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <Link href={linkHref}>{step.label}</Link>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {index < workflowSteps.length - 1 && (
                      <BreadcrumbSeparator />
                    )}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>

          {/* 右側のナビゲーション要素 */}
          <div className="flex items-center space-x-2">
            {/* プロジェクト詳細に戻るボタン */}
            <Button
              variant="outline"
              size="sm"
              asChild
            >
              <Link href={`/projects/${projectId}`}>
                プロジェクト詳細
              </Link>
            </Button>

            {/* 戻るボタン（採点画面でのみ表示） */}
            {pathname.includes('06-score-at-once') && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <Link href={`/projects/${projectId}/05-answer-sheets`}>
                  戻る
                </Link>
              </Button>
            )}
          </div>
        </header>
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </div>
    </>
  )
}
