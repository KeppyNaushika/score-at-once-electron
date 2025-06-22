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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import Link from "next/link"
import { useParams, usePathname } from "next/navigation"
import React, { useState, useEffect } from "react"

// 採点ステップの定義
const scoringSteps = [
  { id: "master-image", label: "1. 模範解答", hrefSuffix: "" },
  { id: "template", label: "2. 採点領域", hrefSuffix: "/template" },
  {
    id: "region-editing",
    label: "3. 領域情報編集",
    hrefSuffix: "/region-info",
  },
  { id: "upload", label: "4. 生徒解答", hrefSuffix: "/upload" },
  { id: "scoring", label: "5. 採点", hrefSuffix: "/scoring" },
  { id: "results", label: "6. 結果", hrefSuffix: "/results" },
]

// ページごとのヒント情報
const pageHints: { [key: string]: { 
  title: string; 
  description: string;
  content: string[];
  tips?: string[];
  shortcuts?: { key: string; description: string }[];
} } = {
  "master-image": {
    title: "模範解答のアップロード",
    description: "試験問題の模範解答をアップロードして、採点の基準となる画像を準備します。",
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
  "template": {
    title: "採点領域の作成",
    description: "模範解答上に採点対象となる領域を視覚的に定義します。各設問や記入欄に対応する矩形領域を作成してください。",
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
  "region-editing": {
    title: "領域情報の編集",
    description: "作成した採点領域に詳細な情報を設定します。各領域の種類、配点、ラベルなどを正確に入力してください。",
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
  "upload": {
    title: "生徒解答のアップロード",
    description: "スキャンした生徒の答案画像をアップロードし、生徒情報との関連付けを行います。",
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
  "scoring": {
    title: "採点",
    description: "効率的な採点インターフェースで、キーボードショートカットを活用した高速採点が可能です。",
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
  "results": {
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

export default function ScoringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const projectId = params.projectId as string
  const [showHintAnimation, setShowHintAnimation] = useState(false)

  // TODO: 試験の進捗状況に応じてステップの有効/無効を管理するロジック
  // 例えば、APIから進捗を取得し、完了済みのステップや現在のステップを特定する
  const completedStepIds = ["master-image", "template"] // 仮の完了済みステップ
  const currentActualStepId = "region-editing" // 仮の現在の実際の進捗ステップ

  // 現在のページを特定
  const currentPageSuffix = pathname.replace(`/projects/${projectId}/score`, "")
  const currentStep = scoringSteps.find(step => step.hrefSuffix === currentPageSuffix)
  const currentHint = currentStep ? pageHints[currentStep.id] : null

  // 初回表示時のアニメーション
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHintAnimation(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [pathname])

  const getStepStatus = (
    stepId: string,
    index: number,
  ): { isCompleted: boolean; isDisabled: boolean; isCurrentPage: boolean } => {
    const currentPathSuffix = pathname.replace(
      `/projects/${projectId}/score`,
      "",
    )
    const isCurrentPage = currentPathSuffix === scoringSteps[index].hrefSuffix

    // 実際の進捗に基づいて判断
    const actualCurrentIndex = scoringSteps.findIndex(
      (s) => s.id === currentActualStepId,
    )
    const isCompleted = completedStepIds.includes(stepId)
    // isDisabled: 現在の実際の進捗より未来のステップで、かつ完了していないステップは無効
    const isDisabled = index > actualCurrentIndex && !isCompleted

    return { isCompleted, isDisabled, isCurrentPage }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="bg-background border-b p-4 flex items-center">
        <Breadcrumb>
          <BreadcrumbList>
            {scoringSteps.map((step, index) => {
              const { isCompleted, isDisabled, isCurrentPage } = getStepStatus(
                step.id,
                index,
              )
              const linkHref = `/projects/${projectId}/score${step.hrefSuffix}`

              return (
                <React.Fragment key={step.id}>
                  <BreadcrumbItem>
                    {isCurrentPage ? (
                      <BreadcrumbPage className="font-semibold text-green-600">
                        {step.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink
                        asChild={!isDisabled} // 無効でない場合のみ Link を使用
                        className={cn(
                          isDisabled
                            ? "text-muted-foreground cursor-not-allowed"
                            : "text-foreground hover:text-foreground/80",
                        )}
                      >
                        {isDisabled ? (
                          <span>{step.label}</span>
                        ) : (
                          <Link href={linkHref}>{step.label}</Link>
                        )}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {index < scoringSteps.length - 1 && <BreadcrumbSeparator />}
                </React.Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        
        {/* Help Icon */}
        {currentHint && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "ml-auto relative",
                  showHintAnimation && "animate-pulse"
                )}
              >
                <Info className="h-5 w-5" />
                {showHintAnimation && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 bg-blue-500 rounded-full animate-ping" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[80vh] overflow-y-auto" align="end">
              <div className="space-y-4">
                {/* Header */}
                <div>
                  <h4 className="font-semibold text-lg mb-1">{currentHint.title}</h4>
                  <p className="text-sm text-muted-foreground">{currentHint.description}</p>
                </div>

                {/* Main Content */}
                <div>
                  <h5 className="font-medium text-sm mb-2 text-blue-600">基本操作</h5>
                  <ul className="text-sm space-y-1">
                    {currentHint.content.map((hint, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2 mt-0.5">•</span>
                        <span>{hint}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tips Section */}
                {currentHint.tips && (
                  <div>
                    <h5 className="font-medium text-sm mb-2 text-green-600">💡 ヒント・推奨事項</h5>
                    <ul className="text-sm space-y-1">
                      {currentHint.tips.map((tip, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-500 mr-2 mt-0.5">▶</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Shortcuts Section */}
                {currentHint.shortcuts && (
                  <div>
                    <h5 className="font-medium text-sm mb-2 text-purple-600">⌨️ キーボードショートカット</h5>
                    <div className="space-y-1">
                      {currentHint.shortcuts.map((shortcut, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <kbd className="px-2 py-1 bg-gray-100 border rounded text-xs font-mono">
                            {shortcut.key}
                          </kbd>
                          <span className="text-sm text-muted-foreground flex-1 ml-3">
                            {shortcut.description}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </header>
      <main className="flex-grow overflow-hidden">{children}</main>
    </div>
  )
}
