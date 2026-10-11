"use client"

import Image from "next/image"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { PdfPageChoice } from "./hooks/useQuestionImageIntake"

interface AiQuestionPdfPageDialogProps {
  /** ページを選ぶ PDF。null なら閉じている */
  choice: PdfPageChoice | null
  /** 選んだページ（key）。空ならやめる */
  onChoose: (chosenKeys: ReadonlySet<string>) => void
}

/**
 * PDF から問題の画像にするページを選ぶ（何ページでも）。ページは Tab で移り、Space で選ぶ・外す。
 * 選んだページは、このあと1枚ずつ切り出す
 */
export function AiQuestionPdfPageDialog({
  choice,
  onChoose,
}: AiQuestionPdfPageDialogProps) {
  return (
    <Dialog
      open={choice !== null}
      onOpenChange={(open) => {
        if (!open) onChoose(new Set())
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        {choice && (
          <PageChoiceForm
            key={choice.fileName}
            choice={choice}
            onChoose={onChoose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PageChoiceForm({
  choice,
  onChoose,
}: {
  choice: PdfPageChoice
  onChoose: (chosenKeys: ReadonlySet<string>) => void
}) {
  // 1ページだけの PDF は、はじめから選んでおく
  const [chosenKeys, setChosenKeys] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        choice.pages.length === 1 ? choice.pages.map((page) => page.key) : []
      )
  )
  const toggle = (pageKey: string) =>
    setChosenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(pageKey)) next.delete(pageKey)
      else next.add(pageKey)
      return next
    })

  return (
    <>
      <DialogHeader>
        <DialogTitle>PDF のページを選ぶ（{choice.fileName}）</DialogTitle>
        <DialogDescription>
          問題の画像にするページを選んでください（何ページでも）。選んだページは、このあと1枚ずつ範囲を切り出します。
        </DialogDescription>
      </DialogHeader>
      <ul className="grid grid-cols-3 gap-2" aria-label="PDF のページ">
        {choice.pages.map((page) => {
          const isChosen = chosenKeys.has(page.key)
          return (
            <li key={page.key}>
              <button
                type="button"
                aria-pressed={isChosen}
                onClick={() => toggle(page.key)}
                className={`w-full rounded border-2 p-1 text-xs ${
                  isChosen ? "border-blue-600 bg-blue-50" : "border-transparent"
                }`}
              >
                <Image
                  src={page.url}
                  alt={page.label}
                  width={200}
                  height={280}
                  unoptimized
                  className="mx-auto h-40 w-auto object-contain"
                />
                <span className="block">
                  {page.label}
                  {isChosen && "（選択中）"}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <DialogFooter>
        <Button variant="outline" onClick={() => onChoose(new Set())}>
          やめる
        </Button>
        <Button
          onClick={() => onChoose(chosenKeys)}
          disabled={chosenKeys.size === 0}
        >
          {chosenKeys.size} ページを切り出しへ
        </Button>
      </DialogFooter>
    </>
  )
}
