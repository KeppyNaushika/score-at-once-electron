"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  type NUpConfig,
  PAGES_PER_SHEET_OPTIONS,
  SLOT_ORDERS,
  type SlotOrder,
} from "@/types/pdfTools.types"

/**
 * 並べ方の表示名。どの角から、どちら向きに埋めるか。狭い出力パネルの1行に収まるよう
 * 矢印で短く書く（読み上げは aria-label と、この名前の「→」で足りる）
 */
const SLOT_ORDER_LABELS: Record<SlotOrder, string> = {
  "from-top-left-rightward": "左上→右",
  "from-top-left-downward": "左上→下",
  "from-top-right-leftward": "右上→左",
  "from-top-right-downward": "右上→下",
}

interface NUpSelectsProps {
  nUp: NUpConfig
  onNUpChange: (nUp: NUpConfig) => void
  disabled?: boolean
  /** 読み上げる名前（1面の数・並べ方） */
  accessibleNames: { pagesPerSheet: string; slotOrder: string }
}

/**
 * N-up の1面の数（Nin1）と並べ方を選ぶ2つの Select。
 *
 * ファイルごとの N-up（左のファイル欄・交互挿入の欄）と全体の N-up（出力パネルの上段）で
 * 同じ選択肢を出すので、選択肢と変換・見た目（size="sm" = 高さ 32px）を1か所にまとめて
 * ずれないようにする。高さは className の h-8 でなく size で決める（SelectTrigger の既定の
 * size="default" が data 属性の h-9 を当て、h-8 より強く効く）。
 */
export default function NUpSelects({
  nUp,
  onNUpChange,
  disabled,
  accessibleNames,
}: NUpSelectsProps) {
  return (
    <>
      <Select
        value={String(nUp.pagesPerSheet)}
        onValueChange={(value) => {
          const pagesPerSheet = PAGES_PER_SHEET_OPTIONS.find(
            (option) => String(option) === value
          )
          if (pagesPerSheet === undefined) return
          onNUpChange({ ...nUp, pagesPerSheet })
        }}
        disabled={disabled}
      >
        <SelectTrigger
          size="sm"
          className="w-20 px-2"
          aria-label={accessibleNames.pagesPerSheet}
        >
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
        value={nUp.slotOrder}
        onValueChange={(value) => {
          const slotOrder = SLOT_ORDERS.find((option) => option === value)
          if (slotOrder === undefined) return
          onNUpChange({ ...nUp, slotOrder })
        }}
        // 1in1 には並べる順が無い
        disabled={disabled || nUp.pagesPerSheet === 1}
      >
        {/*
          並べ方は幅を決め打ちせず、表示中の名前に合わせる（既定の w-fit）。
          min-w は、選び直すたびに幅が変わって隣の欄が動かないように、いちばん長い
          名前のおおよその幅を取っておくもの。並ぶ欄は折り返す。
          左右の余白は既定（px-3）より詰める。出力パネルの「全体」の行（幅800 で約232px）に
          見出し・Nin1・並べ方を1行で収めるため（28 + 8 + 80 + 8 + 104 = 228px）
        */}
        <SelectTrigger
          size="sm"
          className="max-w-full min-w-26 px-2"
          aria-label={accessibleNames.slotOrder}
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
    </>
  )
}
