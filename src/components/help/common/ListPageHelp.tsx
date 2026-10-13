"use client"

import { Lightbulb, MousePointerClick } from "lucide-react"
import React from "react"

import {
  HelpSection,
  StepItem,
  TipItem,
} from "@/components/help/common/HelpComponents"
import { Badge } from "@/components/ui/badge"

/**
 * 一覧（トップページ）の使い方で、どのページも同じ形をしている部品。
 * 一覧の読み方・押し方は4つのトップページで同じなので、違う語だけを受け取る。
 */

/** ページ冒頭の見出し（アイコン＋名前）と説明文 */
export function ListHelpHeader({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 text-xl font-bold">
        {icon}
        {title}
      </h2>
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}

/** 「一覧の読み方・押し方」の節（行・要約・次のステップ・並べ替えの4手順） */
export function ListReadingSteps({
  overviewDescription,
  summaryTitle,
  summaryDescription,
  nextStepDescription,
  sortDescription,
}: {
  /** 手順1「行のどこを押しても概要が開く」の説明 */
  overviewDescription: string
  /** 手順2の見出し（例:「名前の下は要約」） */
  summaryTitle: string
  summaryDescription: string
  nextStepDescription: string
  sortDescription: string
}) {
  return (
    <HelpSection
      icon={<MousePointerClick className="h-5 w-5 text-green-600" />}
      title="一覧の読み方・押し方"
    >
      <div className="space-y-3">
        <StepItem
          number={1}
          title="行のどこを押しても概要が開く"
          description={overviewDescription}
          isImportant
        />
        <StepItem
          number={2}
          title={summaryTitle}
          description={summaryDescription}
        />
        <StepItem
          number={3}
          title="「次のステップ」を押すと続きから"
          description={nextStepDescription}
        />
        <StepItem
          number={4}
          title="見出しを押すと並べ替え"
          description={sortDescription}
        />
      </div>
    </HelpSection>
  )
}

/** 一覧の上に並ぶ操作ボタンの名前をバッジで並べる */
export function ListActionBadges({ labels }: { labels: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {labels.map((label) => (
        <Badge key={label} variant="outline">
          {label}
        </Badge>
      ))}
    </div>
  )
}

/** ページ末尾の電球つきのひとこと */
export function ListHelpTip({ children }: { children: React.ReactNode }) {
  return (
    <TipItem type="info">
      <span className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
        {children}
      </span>
    </TipItem>
  )
}
