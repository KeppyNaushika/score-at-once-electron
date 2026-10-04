"use client"

import type { DragEndEvent } from "@dnd-kit/core"
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { useRef, useState } from "react"

import type { NUpSize } from "@/lib/pdf-tools/nUpLayout"
import {
  type OutputPage,
  type OutputSheet,
  ROTATION_DEGREES,
  type RotationDegree,
} from "@/types/pdfTools.types"

import { pageIdToFocusAfterRemoval } from "./focusAfterRemoval"
import { pagePlacements } from "./pagePlacements"
import { sheetFramesByPageId } from "./sheetFrames"
import SortablePageItem from "./SortablePageItem"

interface OutputPreviewProps {
  /** 出力に載るページ（並び順のとおり）。1ページ1マスで並べる */
  pages: OutputPage[]
  /** pages を N-up の面（全体 N-up なら入れ子）に組んだもの。同じ面のページを枠でくくるのに使う */
  sheets: OutputSheet[]
  /** ドラッグで動かした。移動先のページの直前（後ろへ動かしたなら直後）へ */
  onPageMoved: (
    movedPage: OutputPage,
    targetPage: OutputPage,
    placement: "before" | "after"
  ) => void
  onDeletePage: (page: OutputPage) => void
  onRotatePage: (page: OutputPage, rotation: RotationDegree) => void
  disabled: boolean
  /** 1行あたりに並べる枚数 */
  columns: number
}

/**
 * 出力プレビュー。
 *
 * 面ではなくページを1マスずつ並べ、同じ面に入るページを同じ色の枠でくくる（全体
 * N-up では、全体の面を外側の色の枠、その中のファイルごとの面を内側の破線の枠で）。面は
 * 並び順の後で組むので、ドラッグでページを動かすと組み合わせが変わる。それが見て
 * 分かるように、面の単位ではなくページの単位で並べ替え・回転・除外をさせる。
 */
export default function OutputPreview({
  pages,
  sheets,
  onPageMoved,
  onDeletePage,
  onRotatePage,
  disabled,
  columns,
}: OutputPreviewProps) {
  const sensors = useSensors(
    // 押しただけではドラッグにせず、少し動かしてから始める。カードのどこを
    // つかんでもドラッグでき（回転・除外のボタンの上も）、動かさずに離せばボタンの
    // クリックになる。ドラッグした後のクリックは dnd-kit が握りつぶす
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // サムネイル画像の寸法（ページの id → 寸法。読めなかったら null）。面の格子を
  // 出力と同じ計算で選ぶのに使う。カードの画像が読み込まれたときに測って入れる
  const [thumbnailSizes, setThumbnailSizes] = useState<
    ReadonlyMap<string, NUpSize | null>
  >(new Map())
  const handleThumbnailMeasured = (pageId: string, size: NUpSize | null) => {
    setThumbnailSizes((prev) => {
      const known = prev.get(pageId)
      if (
        prev.has(pageId) &&
        known?.width === size?.width &&
        known?.height === size?.height
      ) {
        return prev
      }
      return new Map(prev).set(pageId, size)
    })
  }

  const placementByPageId = pagePlacements(sheets, thumbnailSizes)
  const sheetFramesOfPage = sheetFramesByPageId(
    pages.map((page) => page.id),
    placementByPageId,
    columns
  )

  // カードの要素（ページの id → フォーカスを受ける要素）。除外したあとに隣のカードへ
  // フォーカスを移すのに使う
  const cardElements = useRef(new Map<string, HTMLElement>())

  /**
   * ページを除外する。キーボードで除外したときは、先に隣のカードへフォーカスを移す
   * （カードの id は並び順のキーで、除外しても残るカードの要素は作り直されないので、
   * 移したフォーカスはそのまま残る）。ポインタで除外したときは移さない
   */
  const handleDeletePage = (
    page: OutputPage,
    trigger: "keyboard" | "pointer"
  ) => {
    if (trigger === "keyboard") {
      const nextPageId = pageIdToFocusAfterRemoval(
        pages.map((candidatePage) => candidatePage.id),
        page.id
      )
      if (nextPageId !== undefined) {
        cardElements.current.get(nextPageId)?.focus()
      }
    }
    onDeletePage(page)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = pages.findIndex((page) => page.id === active.id)
    const newIndex = pages.findIndex((page) => page.id === over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      onPageMoved(
        pages[oldIndex],
        pages[newIndex],
        oldIndex < newIndex ? "after" : "before"
      )
    }
  }

  /** ページを 90° 単位で回す（step: -1 = 左, 1 = 右） */
  const handleRotatePage = (page: OutputPage, step: -1 | 1) => {
    const currentIndex = ROTATION_DEGREES.indexOf(page.rotation)
    const rotation =
      ROTATION_DEGREES[
        (currentIndex + step + ROTATION_DEGREES.length) %
          ROTATION_DEGREES.length
      ]
    onRotatePage(page, rotation)
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        ページを選択してください
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={pages.map((page) => page.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          }}
        >
          {pages.map((page) => (
            <SortablePageItem
              key={page.id}
              page={page}
              placement={placementByPageId.get(page.id)}
              sheetFrames={sheetFramesOfPage.get(page.id) ?? []}
              disabled={disabled}
              cardRef={(element) => {
                cardElements.current.set(page.id, element)
                return () => {
                  cardElements.current.delete(page.id)
                }
              }}
              onDelete={(trigger) => handleDeletePage(page, trigger)}
              onRotateLeft={() => handleRotatePage(page, -1)}
              onRotateRight={() => handleRotatePage(page, 1)}
              onThumbnailMeasured={(size) =>
                handleThumbnailMeasured(page.id, size)
              }
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
