"use client"

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"

import { PDF_EXPORT_MODES, type PdfExportMode } from "@/types/pdfTools.types"
import { isOneOf } from "@/types/stringUnion"

const EXPORT_MODE_LABELS: Record<PdfExportMode, string> = {
  merge: "結合",
  interleave: "交互挿入",
}

interface ExportModeToggleProps {
  mode: PdfExportMode
  onModeChange: (mode: PdfExportMode) => void
  disabled: boolean
}

/**
 * 出力モード（結合・交互挿入）を選ぶボタンの組。出力パネルの見出しの右端に置く。
 *
 * 見た目はボタンを横に並べたセグメント型（他の画面の ToggleGroup の outline・sm・
 * 主色と同じ）だが、中身は radio にする。ToggleGroup は矢印キーでフォーカスを動かす
 * だけで、Space を押すまで選択が変わらない。radio なら矢印キーで選択ごと移る。
 *
 * 端で回り込ませない（loop を切る）。モードを変えると並び順を作り直すので、矢印キーを
 * 押し続けたときに作り直しが繰り返されないようにする（選択肢が2つなので、回り込まなく
 * ても左右の矢印でどちらへも行ける）。
 * ui/radio-group の RadioGroupItem は丸い印の付いた形なので使わず、プリミティブに
 * セグメントの見た目を付ける
 */
export default function ExportModeToggle({
  mode,
  onModeChange,
  disabled,
}: ExportModeToggleProps) {
  return (
    <RadioGroupPrimitive.Root
      value={mode}
      onValueChange={(value) => {
        if (isOneOf(PDF_EXPORT_MODES, value)) onModeChange(value)
      }}
      orientation="horizontal"
      loop={false}
      disabled={disabled}
      aria-label="出力モード"
      className="flex w-fit shrink-0 items-center rounded-md shadow-xs"
    >
      {PDF_EXPORT_MODES.map((exportMode) => (
        <RadioGroupPrimitive.Item
          key={exportMode}
          value={exportMode}
          className="inline-flex h-8 items-center justify-center border border-l-0 border-input bg-transparent px-2.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] outline-none first:rounded-l-md first:border-l last:rounded-r-md hover:bg-accent hover:text-accent-foreground focus-visible:z-10 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
        >
          {EXPORT_MODE_LABELS[exportMode]}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
