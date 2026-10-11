"use client"

import { useMutation } from "@tanstack/react-query"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { usePdfPasswordConversion } from "@/hooks/usePdfPasswordConversion"
import {
  AI_QUESTION_IMAGE_ACCEPTED_TYPES,
  AI_QUESTION_IMAGE_MAX_SOURCE_BYTES,
} from "@/lib/shared/aiGrading/questionImageLimits"
import { importAiQuestionImageMutation } from "@/queries/aiGrading"

/**
 * 切り出しを待つ画像1枚。`originalBytes` は元のファイルのバイト列（全体を使うときは
 * 描き直さずにそのまま送る）。既に取り込んだ画像を切り出し直すときは null
 */
export interface QuestionImageSource {
  key: string
  label: string
  url: string
  originalBytes: Uint8Array | null
  /** 切り出し直すときの、置き換える並びの位置。追加なら null */
  replaceIndex: number | null
  /** 画面で作った URL（使い終わったら片付ける） */
  isObjectUrl: boolean
}

/** PDF のページを選ぶ段の材料 */
export interface PdfPageChoice {
  fileName: string
  pages: QuestionImageSource[]
}

const isAcceptedType = (mediaType: string) =>
  AI_QUESTION_IMAGE_ACCEPTED_TYPES.some(
    (acceptedType) => acceptedType === mediaType
  )

/** バイト列から、画面で表示する URL を作る */
function toObjectUrlSource(
  bytes: Uint8Array,
  mediaType: string,
  label: string
): QuestionImageSource {
  return {
    key: crypto.randomUUID(),
    label,
    url: URL.createObjectURL(
      new Blob([new Uint8Array(bytes)], { type: mediaType })
    ),
    originalBytes: bytes,
    replaceIndex: null,
    isObjectUrl: true,
  }
}

const releaseSource = (source: QuestionImageSource) => {
  if (source.isObjectUrl) URL.revokeObjectURL(source.url)
}

/**
 * 問題の画像の取り込みの流れ（ファイル・貼り付け → PDF ならページを選ぶ → 切り出す → 保存）。
 * 保存できた画像のパスを `onImported` に渡す（置き換えなら位置付きで）
 */
export function useQuestionImageIntake(input: {
  cropRegionId: string
  onImported: (imagePath: string, replaceIndex: number | null) => void
}) {
  const { cropRegionId, onImported } = input
  const [cropQueue, setCropQueue] = useState<QuestionImageSource[]>([])
  const [pdfPageChoice, setPdfPageChoice] = useState<PdfPageChoice | null>(null)
  const [isConverting, setIsConverting] = useState(false)
  const pdfConversion = usePdfPasswordConversion()
  const { convertPdfWithRetry } = pdfConversion
  const importImage = useMutation(importAiQuestionImageMutation())

  /** ファイル（選んだもの・貼り付けたもの）を、切り出しの待ちに並べる */
  const addFiles = useCallback(
    async (files: readonly File[]) => {
      for (const [fileIndex, file] of files.entries()) {
        if (!isAcceptedType(file.type)) {
          toast.error(
            `${file.name}: PNG・JPEG・WebP の画像か、PDF を選んでください`
          )
          continue
        }
        if (file.size > AI_QUESTION_IMAGE_MAX_SOURCE_BYTES) {
          toast.error(`${file.name}: ファイルが大きすぎます（30MB まで）`)
          continue
        }
        if (file.type !== "application/pdf") {
          const bytes = new Uint8Array(await file.arrayBuffer())
          const source = toObjectUrlSource(bytes, file.type, file.name)
          setCropQueue((prev) => [...prev, source])
          continue
        }
        setIsConverting(true)
        try {
          const conversion = await convertPdfWithRetry(file)
          if (conversion === null) continue
          setPdfPageChoice({
            fileName: file.name,
            pages: conversion.images.map((image, index) =>
              toObjectUrlSource(
                new Uint8Array(image.buffer),
                image.type,
                `${index + 1}ページ`
              )
            ),
          })
          // ページを選ぶ段は1つずつ。続きのファイルはそのあとで選び直してもらう
          if (fileIndex < files.length - 1) {
            toast.info(
              "PDF のページを選ぶ間は、続きのファイルを取り込みません。あとでもう一度選んでください"
            )
          }
          return
        } catch (error) {
          toast.error("PDF を画像にできませんでした", {
            description: error instanceof Error ? error.message : undefined,
          })
        } finally {
          setIsConverting(false)
        }
      }
    },
    [convertPdfWithRetry]
  )

  /** PDF の選んだページを切り出しの待ちに並べ、選ばなかったページを片付ける */
  const choosePdfPages = useCallback(
    (chosenKeys: ReadonlySet<string>) => {
      if (!pdfPageChoice) return
      const chosenPages = pdfPageChoice.pages.filter((page) =>
        chosenKeys.has(page.key)
      )
      pdfPageChoice.pages
        .filter((page) => !chosenKeys.has(page.key))
        .forEach(releaseSource)
      setCropQueue((prev) => [
        ...prev,
        ...chosenPages.map((page) => ({
          ...page,
          label: `${pdfPageChoice.fileName}（${page.label}）`,
        })),
      ])
      setPdfPageChoice(null)
    },
    [pdfPageChoice]
  )

  /** 既に取り込んだ画像を切り出し直す（保存すると、その位置の画像を置き換える） */
  const recropImage = useCallback((url: string, replaceIndex: number) => {
    setCropQueue((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        label: `${replaceIndex + 1}枚目`,
        url,
        originalBytes: null,
        replaceIndex,
        isObjectUrl: false,
      },
    ])
  }, [])

  const currentSource = cropQueue[0] ?? null

  /** 切り出しの待ちの先頭を外す */
  const dequeue = useCallback(() => {
    if (currentSource) releaseSource(currentSource)
    setCropQueue((prev) => prev.slice(1))
  }, [currentSource])

  /** 切り出した画像（全体ならそのまま）を保存する */
  const confirmCrop = useCallback(
    (imageBytes: Uint8Array) => {
      if (!currentSource) return
      importImage.mutate(
        { cropRegionId, imageBytes },
        {
          onSuccess: ({ imagePath }) => {
            onImported(imagePath, currentSource.replaceIndex)
            dequeue()
          },
        }
      )
    },
    [cropRegionId, currentSource, dequeue, importImage, onImported]
  )

  return {
    addFiles,
    pdfPageChoice,
    choosePdfPages,
    cancelPdfPages: () => choosePdfPages(new Set()),
    recropImage,
    currentSource,
    remainingCount: Math.max(0, cropQueue.length - 1),
    confirmCrop,
    skipCrop: dequeue,
    isBusy: isConverting || importImage.isPending,
    isSaving: importImage.isPending,
    pdfConversion,
  }
}
