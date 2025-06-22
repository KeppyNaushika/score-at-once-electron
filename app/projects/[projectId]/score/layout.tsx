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
const pageHints: { [key: string]: { title: string; content: string[] } } = {
  "master-image": {
    title: "模範解答のアップロード",
    content: [
      "PDFまたは画像ファイルをアップロードできます",
      "PDFは自動的にページごとに分割されます",
      "ドラッグ&ドロップでページ順序を変更できます",
    ],
  },
  "template": {
    title: "採点領域の作成",
    content: [
      "模範解答上でマウスをドラッグして採点領域を作成します",
      "設問、氏名欄、学籍番号欄など、必要な領域をすべて作成してください",
      "作成した領域は四隅をドラッグしてサイズ変更、中央をドラッグして移動できます",
      "各ページごとに独立した採点領域を設定できます",
    ],
  },
  "region-editing": {
    title: "領域情報の編集",
    content: [
      "各領域の種類、ラベル、配点などを設定します",
      "設問領域には必ず設問番号と配点を設定してください",
      "行をドラッグして順序を変更できます",
      "変更は自動的に保存されます",
    ],
  },
  "upload": {
    title: "生徒解答のアップロード",
    content: [
      "生徒の答案をアップロードします",
      "ファイル名から自動的に生徒を推測します",
      "複数ファイルを一度にアップロードできます",
    ],
  },
  "scoring": {
    title: "採点",
    content: [
      "キーボードショートカットで効率的に採点できます",
      "複数の教員で同時に採点可能です",
      "部分点やコメントも入力できます",
    ],
  },
  "results": {
    title: "結果",
    content: [
      "採点結果を確認・出力できます",
      "Excel形式での出力に対応しています",
      "個人成績表も生成可能です",
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
            <PopoverContent className="w-80" align="end">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">{currentHint.title}</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {currentHint.content.map((hint, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-500 mr-2">•</span>
                      <span>{hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </PopoverContent>
          </Popover>
        )}
      </header>
      <main className="flex-grow overflow-hidden">{children}</main>
    </div>
  )
}
