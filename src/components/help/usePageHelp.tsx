"use client"

import { BookOpen } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useState } from "react"

import { HelpContent01Upload } from "@/components/help/page-specific/HelpContent01Upload"
import { HelpContent02Template } from "@/components/help/page-specific/HelpContent02Template"
import { HelpContent03RegionInfo } from "@/components/help/page-specific/HelpContent03RegionInfo"
import { HelpContent04QuestionGroup } from "@/components/help/page-specific/HelpContent04QuestionGroup"
import { HelpContent05Students } from "@/components/help/page-specific/HelpContent05Students"
import { HelpContent06StudentAnswers } from "@/components/help/page-specific/HelpContent06StudentAnswers"
import { HelpContent07Scoring } from "@/components/help/page-specific/HelpContent07Scoring"
import { HelpContent08Export } from "@/components/help/page-specific/HelpContent08Export"
import { HelpContentClassrooms } from "@/components/help/page-specific/HelpContentClassrooms"
import { HelpContentStudents } from "@/components/help/page-specific/HelpContentStudents"
import { HelpContentSubtotalGroups } from "@/components/help/page-specific/HelpContentSubtotalGroups"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

// ページごとのヘルプコンポーネント
const pageHelpComponents: {
  [key: string]: React.ComponentType
} = {
  "01-upload": HelpContent01Upload,
  "02-template": HelpContent02Template,
  "03-region-info": HelpContent03RegionInfo,
  "04-question-group": HelpContent04QuestionGroup,
  "05-students": HelpContent05Students,
  "06-student-answers": HelpContent06StudentAnswers,
  "07-score-at-once": HelpContent07Scoring,
  "08-export": HelpContent08Export,
  "subtotal-groups": HelpContentSubtotalGroups,
  classrooms: HelpContentClassrooms,
  students: HelpContentStudents,
}

/** 現在のページに対応するヘルプコンテンツを全画面モーダルで表示するフック */
export function usePageHelp() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // 現在のページを特定
  const getCurrentPageId = () => {
    const pathSegments = pathname.split("/")
    const lastSegment = pathSegments[pathSegments.length - 1]

    // 特別なページパスを処理
    if (pathname.includes("subtotal-groups")) {
      return "subtotal-groups"
    }
    if (pathname.includes("/classrooms") && !pathname.includes("exams")) {
      return "classrooms"
    }
    if (pathname.includes("/students") && !pathname.includes("exams")) {
      return "students"
    }

    // 完全一致を優先的にチェック
    if (Object.keys(pageHelpComponents).includes(lastSegment)) {
      return lastSegment
    }

    // 部分一致での検索（従来の方法）
    return Object.keys(pageHelpComponents).find((key) =>
      lastSegment.includes(key.split("-")[1])
    )
  }

  const currentPageId = getCurrentPageId()
  const CurrentHelpComponent = currentPageId
    ? pageHelpComponents[currentPageId]
    : null

  // ページタイトルを取得
  const getPageTitle = () => {
    const titles: { [key: string]: string } = {
      "01-upload": "模範解答アップロード",
      "02-template": "採点領域作成",
      "03-region-info": "領域情報",
      "04-question-group": "小計点の設定",
      "05-students": "受験生徒管理",
      "06-student-answers": "答案アップロード",
      "07-score-at-once": "一括採点",
      "08-export": "結果出力",
      "subtotal-groups": "小計点グループ管理",
      classrooms: "学級管理",
      students: "生徒管理",
    }
    return (currentPageId && titles[currentPageId]) || "ヘルプ"
  }

  const createHelpButton = () => {
    if (!CurrentHelpComponent) return null

    return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-gray-600">
            <BookOpen className="h-4 w-4" />
            使い方
          </Button>
        </DialogTrigger>
        <DialogContent className="flex h-[92vh] w-[95vw] max-w-350 flex-col gap-0 overflow-hidden border-gray-200 bg-white p-0 sm:max-w-350">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-6 py-4 text-left lg:px-10">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <BookOpen className="h-4 w-4 text-blue-600" />
              使い方ガイド
            </DialogTitle>
            <DialogDescription className="sr-only">
              {getPageTitle()}の操作方法とヒントを確認できます
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-x-hidden overflow-y-auto bg-white">
            <article className="mx-auto w-full max-w-4xl px-6 py-10 sm:px-10 lg:px-14">
              <CurrentHelpComponent />
            </article>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return {
    helpButton: createHelpButton(),
  }
}
