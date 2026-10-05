"use client"

import { BarChart3, CircleDollarSign, Settings } from "lucide-react"
import { useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { useAiGradingSettings } from "../hooks/useAiGradingSettings"
import { AiGradingSettingsTab } from "./AiGradingSettingsTab"
import { AiPricingTab } from "./AiPricingTab"
import { AiTokenUsageTab } from "./AiTokenUsageTab"

const AI_GRADING_TABS = ["settings", "pricing", "usage"] as const
export type AiGradingTab = (typeof AI_GRADING_TABS)[number]

/** URL のクエリの値をタブにする。知らない値なら「設定」 */
export function parseAiGradingTab(tabQuery: string | null): AiGradingTab {
  return (
    AI_GRADING_TABS.find((aiGradingTab) => aiGradingTab === tabQuery) ??
    "settings"
  )
}

interface AiGradingTabsProps {
  initialTab: AiGradingTab
}

/**
 * 「設定」「料金」「使用トークン」のタブ。
 *
 * 機能は同意するまで存在しないものとして扱う（設計 §9-1）。今の利用者の今の同意が
 * 1つも無いうちは「設定」（同意の入口と説明）だけを使え、他のタブは押せない
 */
export function AiGradingTabs({ initialTab }: AiGradingTabsProps) {
  const { hasAnyCurrentConsent, isLoading } = useAiGradingSettings()
  const [chosenTab, setChosenTab] = useState<AiGradingTab>(initialTab)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }

  const activeTab = hasAnyCurrentConsent ? chosenTab : "settings"

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => setChosenTab(parseAiGradingTab(value))}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="settings" className="gap-2">
          <Settings className="h-4 w-4" />
          設定
        </TabsTrigger>
        <TabsTrigger
          value="pricing"
          className="gap-2"
          disabled={!hasAnyCurrentConsent}
        >
          <CircleDollarSign className="h-4 w-4" />
          料金
        </TabsTrigger>
        <TabsTrigger
          value="usage"
          className="gap-2"
          disabled={!hasAnyCurrentConsent}
        >
          <BarChart3 className="h-4 w-4" />
          使用トークン
        </TabsTrigger>
      </TabsList>
      {!hasAnyCurrentConsent && (
        <p className="text-xs text-muted-foreground">
          「料金」と「使用トークン」は、事業者に同意すると使えます。
        </p>
      )}

      <TabsContent value="settings">
        <AiGradingSettingsTab />
      </TabsContent>
      {hasAnyCurrentConsent && (
        <>
          <TabsContent value="pricing">
            <AiPricingTab />
          </TabsContent>
          <TabsContent value="usage">
            <AiTokenUsageTab />
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}
