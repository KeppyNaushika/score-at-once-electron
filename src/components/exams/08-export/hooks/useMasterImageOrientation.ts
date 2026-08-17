"use client"

import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import type { PdfOrientation } from "@/components/exams/08-export/types"
import { masterImagesQuery } from "@/queries/exam"
import { fileProtocolPathQuery } from "@/queries/misc"

/**
 * 模範解答1ページ目の縦横比から用紙の向きを決める。
 *
 * 縦横は DB に無い（`ExamPage` が持つのはパスと用紙サイズだけ）ので、画像を1枚
 * 読んで測る。取得は2つのクエリ（模範解答ページ・パスの解決）が担い、ここは
 * 測るところだけを持つ。測定はブラウザの仕事なので effect でよい。
 *
 * @returns 測れていなければ null（既定値の上書きをしない合図）
 */
export function useMasterImageOrientation(
  examId: string
): PdfOrientation | null {
  const { data: masterImages } = useQuery(masterImagesQuery(examId))
  const imagePath = masterImages?.[0]?.imagePath ?? ""

  const { data: imageUrl } = useQuery({
    ...fileProtocolPathQuery(imagePath),
    enabled: Boolean(imagePath),
  })

  // 測り終えた向きは、どの URL に対するものかを一緒に持つ。ページを差し替えれば
  // 一致しなくなるので、消去の effect が要らない
  const [measured, setMeasured] = useState<{
    imageUrl: string
    orientation: PdfOrientation
  } | null>(null)

  useEffect(() => {
    if (!imageUrl) return
    let cancelled = false

    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      setMeasured({
        imageUrl,
        orientation:
          image.naturalWidth > image.naturalHeight ? "landscape" : "portrait",
      })
    }
    image.src = imageUrl

    return () => {
      cancelled = true
    }
  }, [imageUrl])

  return measured && measured.imageUrl === imageUrl
    ? measured.orientation
    : null
}
