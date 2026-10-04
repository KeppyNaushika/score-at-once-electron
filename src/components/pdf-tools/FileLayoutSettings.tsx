"use client"

import { RotateCw } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type ImportedFile,
  PAGES_PER_SHEET_OPTIONS,
  ROTATION_DEGREES,
  SLOT_ORDERS,
  type SlotOrder,
} from "@/types/pdfTools.types"

/** 並べ方の表示名 */
const SLOT_ORDER_LABELS: Record<SlotOrder, string> = {
  "from-top-left-rightward": "左上から右へ（Z）",
  "from-top-left-downward": "左上から下へ（N）",
  "from-top-right-leftward": "右上から左へ",
  "from-top-right-downward": "右上から下へ",
}

interface FileLayoutSettingsProps {
  file: ImportedFile
  onFileUpdated: (file: ImportedFile) => void
  disabled?: boolean
}

/**
 * ファイルの N-up（1面のページ数・並べ方）と回転の既定を選ぶ欄。
 *
 * 左のファイル欄と交互挿入の欄の両方に置く。交互挿入では1回に入れるページ数を
 * N に合わせると面と他のファイルが交互になるので、N を隣に見せたい。2か所で同じ
 * ファイルの設定を書き換えるので、選択肢と変換を1か所にまとめてずれないようにする。
 *
 * 行×列と用紙の縦横は選ばせない。ページの縦横（回転後）から、ページが最も大きく
 * 収まる方を書き出すときに決める。
 */
export default function FileLayoutSettings({
  file,
  onFileUpdated,
  disabled,
}: FileLayoutSettingsProps) {
  return (
    <>
      <Select
        value={String(file.nUp.pagesPerSheet)}
        onValueChange={(value) => {
          const pagesPerSheet = PAGES_PER_SHEET_OPTIONS.find(
            (option) => String(option) === value
          )
          if (pagesPerSheet === undefined) return
          onFileUpdated({ ...file, nUp: { ...file.nUp, pagesPerSheet } })
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-24" aria-label="1面のページ数">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAGES_PER_SHEET_OPTIONS.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}in1
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={file.nUp.slotOrder}
        onValueChange={(value) => {
          const slotOrder = SLOT_ORDERS.find((option) => option === value)
          if (slotOrder === undefined) return
          onFileUpdated({ ...file, nUp: { ...file.nUp, slotOrder } })
        }}
        // 1in1 には並べる順が無い
        disabled={disabled || file.nUp.pagesPerSheet === 1}
      >
        {/*
          並べ方と回転は幅を決め打ちせず、表示中の名前に合わせる（既定の w-fit）。
          決め打ちの幅では、フォントや角度の桁数しだいで名前や「0°」が切れた。
          min-w は、選び直すたびに幅が変わって隣の欄が動かないように、いちばん長い
          名前のおおよその幅を取っておくもの。並ぶ欄は折り返す
        */}
        <SelectTrigger
          className="h-8 max-w-full min-w-44"
          aria-label="面の中の並べ方"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SLOT_ORDERS.map((slotOrder) => (
            <SelectItem key={slotOrder} value={slotOrder}>
              {SLOT_ORDER_LABELS[slotOrder]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={String(file.rotation)}
        onValueChange={(value) => {
          const rotation = ROTATION_DEGREES.find(
            (option) => String(option) === value
          )
          if (rotation === undefined) return
          onFileUpdated({ ...file, rotation })
        }}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 min-w-24" aria-label="ページの回転">
          <RotateCw className="mr-1 h-3 w-3" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROTATION_DEGREES.map((rotation) => (
            <SelectItem key={rotation} value={String(rotation)}>
              {rotation}°
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}
