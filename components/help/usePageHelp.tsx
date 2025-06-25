"use client"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { Info } from "lucide-react"
import { usePathname } from "next/navigation"
import React, { useState, useEffect } from "react"
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
  "04-students": StudentsHelpContent,
  "05-answer-sheets": AnswerSheetsHelpContent,
  "06-score-at-once": ScoringHelpContent,
  "07-export": ExportHelpContent,
}

export function usePageHelp() {
  const pathname = usePathname()
  const [showHintAnimation, setShowHintAnimation] = useState(false)

  // 現在のページを特定
  const getCurrentPageId = () => {
    const pathSegments = pathname.split('/')
    const lastSegment = pathSegments[pathSegments.length - 1]
    return Object.keys(pageHelpComponents).find(key => lastSegment.includes(key.split('-')[1]))
  }

  const currentPageId = getCurrentPageId()
  const CurrentHelpComponent = currentPageId ? pageHelpComponents[currentPageId] : null

  // 初回表示時のアニメーション
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowHintAnimation(true)
    }, 500)
    return () => clearTimeout(timer)
  }, [pathname])

  const createHelpButton = () => {
    if (!CurrentHelpComponent) return null

    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "relative",
              showHintAnimation && "animate-pulse",
            )}
          >
            <Info className="h-4 w-4" />
            {showHintAnimation && (
              <span className="absolute -top-1 -right-1 h-3 w-3 animate-ping rounded-full bg-blue-500" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="m-4 max-h-[90vh] w-[90vw] max-w-4xl overflow-y-auto"
          align="center"
          side="bottom"
        >
          <div className="p-2">
            <CurrentHelpComponent />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return {
    helpButton: createHelpButton(),
    hasHelp: !!CurrentHelpComponent
  }
}