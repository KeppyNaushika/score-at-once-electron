"use client"

import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Info } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useState } from "react"
import {
  UploadHelpContent,
  TemplateHelpContent,
  RegionInfoHelpContent,
  StudentsHelpContent,
  AnswerSheetsHelpContent,
  ScoringHelpContent,
  ExportHelpContent,
} from "./PageHelpContent"

// ページごとのヘルプコンポーネント
const pageHelpComponents: {
  [key: string]: React.ComponentType
} = {
  "01-upload": UploadHelpContent,
  "02-template": TemplateHelpContent,
  "03-region-info": RegionInfoHelpContent,
  "05-students": StudentsHelpContent,
  "06-answer-sheets": AnswerSheetsHelpContent,
  "07-score-at-once": ScoringHelpContent,
  "08-export": ExportHelpContent,
}

export function usePageHelp() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // 現在のページを特定
  const getCurrentPageId = () => {
    const pathSegments = pathname.split('/')
    const lastSegment = pathSegments[pathSegments.length - 1]
    return Object.keys(pageHelpComponents).find(key => lastSegment.includes(key.split('-')[1]))
  }

  const currentPageId = getCurrentPageId()
  const CurrentHelpComponent = currentPageId ? pageHelpComponents[currentPageId] : null

  // ページタイトルを取得
  const getPageTitle = () => {
    const titles: { [key: string]: string } = {
      "01-upload": "模範解答アップロード",
      "02-template": "採点領域作成",
      "03-region-info": "領域情報編集",
      "05-students": "受験生徒管理",
      "06-answer-sheets": "答案アップロード",
      "07-score-at-once": "一括採点",
      "08-export": "結果出力",
    }
    return currentPageId ? titles[currentPageId] : "ヘルプ"
  }

  const createHelpButton = () => {
    if (!CurrentHelpComponent) return null

    return (
      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative"
          >
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
    hasHelp: !!CurrentHelpComponent
  }
}
