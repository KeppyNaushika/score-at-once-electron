"use client"

import { useQueries } from "@tanstack/react-query"
import Image from "next/image"
import { useCallback, useState } from "react"

import { fileProtocolPathQuery } from "@/queries/misc"

import { AiQuestionImageZoomDialog } from "./AiQuestionImageZoomDialog"

interface AiQuestionImageStripProps {
  /** 問題の画像（data ディレクトリからの相対パス）を送る順に */
  imagePaths: readonly string[]
}

/** プロンプトの版の問題の画像を、送る順に小さく並べる。押すと拡大する */
export function AiQuestionImageStrip({
  imagePaths,
}: AiQuestionImageStripProps) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null)
  const imageUrls = useQueries({
    queries: imagePaths.map((imagePath) => fileProtocolPathQuery(imagePath)),
    combine: useCallback(
      (results: { data?: string }[]) =>
        results.map((result) => result.data ?? ""),
      []
    ),
  })

  return (
    <>
      <ol className="flex flex-wrap gap-1" aria-label="問題の画像（送る順）">
        {imagePaths.map((imagePath, index) => (
          <li key={imagePath}>
            <button
              type="button"
              aria-label={`問題の画像 ${index + 1}枚目を拡大`}
              onClick={() => setZoomIndex(index)}
              className="flex h-12 w-12 items-center justify-center overflow-hidden rounded border bg-muted/40"
            >
              {imageUrls[index] ? (
                <Image
                  src={imageUrls[index]}
                  alt={`問題の画像 ${index + 1}枚目`}
                  width={48}
                  height={48}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="tabular-nums">{index + 1}</span>
              )}
            </button>
          </li>
        ))}
      </ol>
      <AiQuestionImageZoomDialog
        imageUrls={imageUrls}
        index={zoomIndex}
        onIndexChange={setZoomIndex}
      />
    </>
  )
}
