"use client"

import { Info } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useState } from "react"

import { HelpContent01Upload as UploadHelpContent } from "@/components/help/page-specific/HelpContent01Upload"
import { HelpContent02Template as TemplateHelpContent } from "@/components/help/page-specific/HelpContent02Template"
import { HelpContent03RegionInfo as RegionInfoHelpContent } from "@/components/help/page-specific/HelpContent03RegionInfo"
import { HelpContent04QuestionGroup as QuestionGroupHelpContent } from "@/components/help/page-specific/HelpContent04QuestionGroup"
import { HelpContent05Students as StudentsHelpContent } from "@/components/help/page-specific/HelpContent05Students"
import { HelpContent06StudentAnswers as StudentAnswersHelpContent } from "@/components/help/page-specific/HelpContent06StudentAnswers"
import { HelpContent07Scoring as ScoringHelpContent } from "@/components/help/page-specific/HelpContent07Scoring"
import { HelpContent08Export as ExportHelpContent } from "@/components/help/page-specific/HelpContent08Export"
import { HelpContentClasses as ClassesHelpContent } from "@/components/help/page-specific/HelpContentClasses"
import { HelpContentSubtotalGroups as SubtotalGroupsHelpContent } from "@/components/help/page-specific/HelpContentSubtotalGroups"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

// ページごとのヘルプコンポーネント
const pageHelpComponents: {
  [key: string]: React.ComponentType
} = {
  "01-upload": UploadHelpContent,
  "02-template": TemplateHelpContent,
  "03-region-info": RegionInfoHelpContent,
  "04-question-group": QuestionGroupHelpContent,
  "05-students": StudentsHelpContent,
  "06-student-answers": StudentAnswersHelpContent,
  "07-score-at-once": ScoringHelpContent,
  "08-export": ExportHelpContent,
  "subtotal-groups": SubtotalGroupsHelpContent,
  classes: ClassesHelpContent,
  students: StudentsHelpContent,
}

/** 現在のページに対応するヘルプコンテンツをDrawer表示するフック */
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
    if (pathname.includes("/classes") && !pathname.includes("exams")) {
      return "classes"
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
    }
    return currentPageId ? titles[currentPageId] : "ヘルプ"
  }

  const createHelpButton = () => {
    if (!CurrentHelpComponent) return null

    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button variant="ghost" size="sm" className="relative">
            <Info className="h-4 w-4" />
          </Button>
        </DrawerTrigger>
        <DrawerContent className="h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>{getPageTitle()}の使い方</DrawerTitle>
            <DrawerDescription>
              このページの操作方法とヒントを確認できます
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <CurrentHelpComponent />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return {
    helpButton: createHelpButton(),
  }
}
