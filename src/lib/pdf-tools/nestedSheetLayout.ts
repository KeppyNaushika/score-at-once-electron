/**
 * 入れ子の N-up の面（全体 N-up）の配置を、元ページ（葉）ごとの配置に畳む純関数。
 *
 * 全体 N-up では、全体の面のスロットにファイルごとの面が入る。描く側（PDF の drawPage、
 * PNG の canvas、プレビューの図）に入れ子を描かせると、内側の面を一度ページにして
 * 縮める処理が要り、PNG では画質も落ちる。そこで木を内側から組み、最後に「葉ごとの
 * 用紙上の矩形と回転」の平らな一覧にして渡す。描く側は葉を1枚ずつ置くだけで済む。
 *
 * 各段の格子と用紙の向きは `computeSheetLayout` に任せる。子が面なら、その面の用紙の
 * 寸法を中身の寸法として渡す（面は回さないので回転は 0）。入れ子でない面は、従来の
 * `computeSheetLayout` と同じ配置になる。
 */
import type { NUpConfig, RotationDegree } from "@/types/pdfTools.types"

import {
  computeSheetLayout,
  type NUpRect,
  type NUpSize,
  slotPosition,
} from "./nUpLayout"

/** 木の葉: 回す前の寸法の分かった元ページ。Leaf は描く側が葉に結び付けるもの */
export interface LayoutPage<Leaf> {
  kind: "page"
  leaf: Leaf
  width: number
  height: number
  /** スロットの中で回す角度（時計回り） */
  rotation: RotationDegree
}

/** 木の節: N-up の面。スロットには葉か面が入る（null は空きスロット） */
export interface LayoutSheet<Leaf> {
  kind: "sheet"
  nUp: NUpConfig
  slots: (LayoutPage<Leaf> | LayoutSheet<Leaf> | null)[]
}

/** 葉が、ある段の面の格子のどのマスに入るか */
export interface SheetCellPosition {
  rows: number
  columns: number
  row: number
  column: number
}

/** 葉1枚の置き場所 */
interface LeafPlacement<Leaf> {
  leaf: Leaf
  /** 回した後の葉を置く、出力用紙の上の矩形（左上原点） */
  placement: NUpRect
  rotation: RotationDegree
  /** 葉が入るマス。外側の面から順に、段ごとに1つ */
  cellPath: SheetCellPosition[]
}

interface NestedSheetLayout<Leaf> {
  /** 出力用紙（向きは中身から決めたもの） */
  paper: NUpSize
  /** 葉の置き場所。木をスロットの順（読む順）にたどった順 */
  leaves: LeafPlacement<Leaf>[]
}

/** 先に組んだスロットの中身: 葉か、組み終えた内側の面 */
type LaidOutChild<Leaf> =
  | { kind: "page"; page: LayoutPage<Leaf> }
  | { kind: "sheet"; layout: NestedSheetLayout<Leaf> }

/**
 * 面の木を組み、葉ごとの置き場所に畳む。
 *
 * 内側の面を先に組み、その用紙の寸法を外側のスロットの中身にする。外側で中身を
 * 縦横比を保って収めた矩形へ、内側の葉の矩形を同じ倍率で写す。
 *
 * @param paper 用紙（向きは問わない。各段の面の縦横は中身から決める）
 * @returns 葉が1枚も無い（空きスロットと空の面だけの）とき null
 */
export function layoutNestedSheet<Leaf>(
  sheet: LayoutSheet<Leaf>,
  paper: NUpSize
): NestedSheetLayout<Leaf> | null {
  // 子の面を先に組む（空の面は空きスロットとして扱う）
  const children = sheet.slots.map((slot): LaidOutChild<Leaf> | null => {
    if (!slot) return null
    if (slot.kind === "page") return { kind: "page", page: slot }
    const childLayout = layoutNestedSheet(slot, paper)
    return childLayout ? { kind: "sheet", layout: childLayout } : null
  })
  if (children.every((child) => child === null)) return null

  const layout = computeSheetLayout(
    sheet.nUp,
    children.map((child) => {
      if (!child) return null
      if (child.kind === "page") return child.page
      // 面は回さない。用紙の寸法がそのまま中身の寸法になる
      return {
        width: child.layout.paper.width,
        height: child.layout.paper.height,
        rotation: 0,
      }
    }),
    paper
  )

  const leaves = children.flatMap((child, slotIndex) => {
    const placement = layout.placements[slotIndex]
    if (!child || !placement) return []
    const cell = {
      rows: layout.rows,
      columns: layout.columns,
      ...slotPosition(slotIndex, layout, sheet.nUp.slotOrder),
    }
    if (child.kind === "page") {
      return [
        {
          leaf: child.page.leaf,
          placement,
          rotation: child.page.rotation,
          cellPath: [cell],
        },
      ]
    }
    // 内側の用紙をスロットへ収めた矩形に、内側の葉を同じ倍率で写す
    // （縦横比を保って収めているので、幅で測っても高さで測っても同じ倍率）
    const scale = placement.width / child.layout.paper.width
    return child.layout.leaves.map((innerLeaf) => ({
      ...innerLeaf,
      placement: {
        x: placement.x + innerLeaf.placement.x * scale,
        yTop: placement.yTop + innerLeaf.placement.yTop * scale,
        width: innerLeaf.placement.width * scale,
        height: innerLeaf.placement.height * scale,
      },
      cellPath: [cell, ...innerLeaf.cellPath],
    }))
  })

  return { paper: layout.paper, leaves }
}
