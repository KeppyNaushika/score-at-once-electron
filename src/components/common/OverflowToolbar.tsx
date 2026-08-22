"use client"

import { MoreHorizontal } from "lucide-react"
import type { ComponentProps, ReactNode } from "react"
import { useEffect, useEffectEvent, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * 一覧ページのヘッダー右に並べる操作1件。
 *
 * `node` と `collapsedNode` を別に受け取るのは、**「…」の中では popover を開けない**
 * ため。並びに出ているタグ絞り込みは popover のボタンだが、それをそのまま「…」の中へ
 * 入れると popover の中で popover を開くことになる。中では popover ではなく、その場に
 * 開いた項目として置く姿を、呼び手に書いてもらう。
 */
export interface ToolbarAction {
  id: string
  /** 大きいほど後まで残る。検索欄を最上位にする */
  priority: number
  /** 並びに出す姿 */
  node: ReactNode
  /** 「…」の中に入ったときの姿（popover を持つものは、入れ子にせず項目として開く形へ） */
  collapsedNode: ReactNode
}

/**
 * 幅を測るためだけに置く控えの並びの中で、操作1件を指す目印。
 * 属性は下の JSX に直接書いてあるので、変えるときは両方を揃えること。
 */
const GHOST_ITEM_SELECTOR = "[data-overflow-toolbar-ghost-item]"
/** 控えの並びの中の「…」。畳んだときに要る幅を測る */
const GHOST_OVERFLOW_SELECTOR = "[data-overflow-toolbar-ghost-overflow]"
/** 控えの並びの子が、どの操作のものかを言う属性 */
const GHOST_ID_ATTRIBUTE = "data-overflow-toolbar-id"

/** 測り終えた操作1件 */
interface ActionMeasurement {
  id: string
  priority: number
  /** 並びに出したときに要る幅 */
  width: number
  /** 呼び手が渡した並び順（同じ優先度のときは、右にあるものから畳む） */
  index: number
}

/**
 * 測った幅から「どれを畳むか」を決める。
 *
 * **入力に「いまの畳み具合」が入っていないことが、振動しない理由そのもの。**
 * `availableWidth` は器（親いっぱいの幅で `overflow-hidden`）の幅なので、中身が
 * 溢れても広がらない。各操作の幅は**常に全部を並べたままの控えの並び**から測るので、
 * 畳んでも縮まない。どちらも畳んだ結果に左右されないため
 * `availableWidth → collapsedIds` は純粋な関数になり、
 * 「畳む→幅が空く→戻す→また溢れる」の輪ができない。
 * だから、畳む閾値と戻す閾値をずらすヒステリシスは要らない。
 */
function decideCollapsedIds(
  measurements: ActionMeasurement[],
  overflowWidth: number,
  gap: number,
  availableWidth: number
): Set<string> {
  // まだ測れていない（描く前・隠れている）。ここで全部畳むと一瞬「…」だけになるので、
  // 何も畳まず、溢れたぶんは器の overflow-hidden に切り落とさせる
  if (availableWidth <= 0) return new Set()

  const gapTotal = (count: number) => Math.max(0, count - 1) * gap
  const naturalWidth =
    measurements.reduce((sum, measurement) => sum + measurement.width, 0) +
    gapTotal(measurements.length)
  if (naturalWidth <= availableWidth) return new Set()

  // 優先度の低いものから外す。同じ優先度なら右にあるものから
  const dropOrder = [...measurements].sort((left, right) =>
    left.priority !== right.priority
      ? left.priority - right.priority
      : right.index - left.index
  )

  // 1つでも畳めば「…」が並びに加わるので、その幅と手前の隙間を先に引いておく
  const budget = availableWidth - overflowWidth - gap
  const collapsedIds = new Set<string>()
  let remainingWidth = naturalWidth
  for (const measurement of dropOrder) {
    if (remainingWidth <= budget) break
    collapsedIds.add(measurement.id)
    remainingWidth -= measurement.width + gap
  }
  return collapsedIds
}

/** 隙間の幅。style が付いていない環境（jsdom 等）では NaN になるので 0 とみなす */
function readColumnGap(row: HTMLElement): number {
  const columnGap = Number.parseFloat(window.getComputedStyle(row).columnGap)
  return Number.isFinite(columnGap) ? columnGap : 0
}

/** 同じ顔ぶれなら state を差し替えない（無駄な再描画と、その先の再測定を止める） */
function sameIds(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false
  for (const id of left) {
    if (!right.has(id)) return false
  }
  return true
}

/**
 * 「…」の見た目。控えの並びと本物で同じ幅にするため、姿はここ1つに集める。
 *
 * **受けた props をそのまま `Button` へ渡すこと。** `PopoverTrigger asChild` は
 * この要素を `cloneElement` して `onClick` と `ref` を載せてくるので、ここで
 * 落とすと「…」を押しても何も起きない（控えの並びで幅は測れているのに、本物の
 * ボタンだけが死ぬ）。
 */
function OverflowTriggerButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="outline"
      size="icon"
      {...props}
      className={cn("size-8 shrink-0 rounded-lg", className)}
    >
      <MoreHorizontal className="h-4 w-4" />
    </Button>
  )
}

/**
 * ヘッダー右の並び。**幅に入りきらないぶんを実測して「…」へ畳む。**
 *
 * 閾値（`md:` `lg:`）で決め打ちにしていないのは、ラベルの幅が画面ごとに違い
 * （「.score 読み込み」と「.coursework 読み込み」）、選択したときだけ現れる一括操作で
 * 幅が急に増えるため。4画面で同じ閾値を共有できない。
 *
 * ## 初回のちらつきをどうしたか
 *
 * **隠さず、溢れたぶんを切り落とすだけにした。** 測るのは描いたあとなので、初回は
 * 一瞬すべてが並ぶ。`ResizeObserver` は `observe()` した直後に一度呼ばれ、その配送は
 * 描画の前に入るので、実際に目に入るのは事前描画された HTML が hydration される前の
 * 一瞬だけである。そこで並び全体を隠すと、ヘッダーが空白から生えてくる見え方になり、
 * 高さも動く。**切り落とすほうが、動くものが少ない。**
 */
export function OverflowToolbar({ actions }: { actions: ToolbarAction[] }) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  // ref ではなく state で受けるのは、要素が付いた時点で下の effect を動かすため
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [ghostRow, setGhostRow] = useState<HTMLDivElement | null>(null)

  /**
   * 測って畳み具合を決める。
   *
   * `useEffectEvent` なので、呼び手が `actions` を毎回組み直しても
   * `ResizeObserver` を作り直さずに済む（下の effect の依存は器と控えの並びだけ）。
   */
  const remeasure = useEffectEvent(() => {
    if (container === null || ghostRow === null) return

    const ghostItemsById = new Map<string, HTMLElement>()
    for (const ghostItem of ghostRow.querySelectorAll<HTMLElement>(
      GHOST_ITEM_SELECTOR
    )) {
      const actionId = ghostItem.getAttribute(GHOST_ID_ATTRIBUTE)
      if (actionId !== null) ghostItemsById.set(actionId, ghostItem)
    }

    const measurements = actions.map((action, index) => {
      const ghostItem = ghostItemsById.get(action.id)
      return {
        id: action.id,
        priority: action.priority,
        width: ghostItem ? ghostItem.getBoundingClientRect().width : 0,
        index,
      }
    })
    const ghostOverflow = ghostRow.querySelector<HTMLElement>(
      GHOST_OVERFLOW_SELECTOR
    )

    const nextCollapsedIds = decideCollapsedIds(
      measurements,
      ghostOverflow ? ghostOverflow.getBoundingClientRect().width : 0,
      readColumnGap(ghostRow),
      container.getBoundingClientRect().width
    )
    setCollapsedIds((previousIds) =>
      sameIds(previousIds, nextCollapsedIds) ? previousIds : nextCollapsedIds
    )
  })

  useEffect(() => {
    if (container === null || ghostRow === null) return
    // Electron（Chromium）には必ずあるが、持たない環境で落とさない。
    // 測れないときは何も畳まない＝溢れを切り落とすだけになる
    if (typeof ResizeObserver === "undefined") return

    const observer = new ResizeObserver(() => remeasure())
    // 器 = 使える幅、控えの並び = 全部並べたときに要る幅。
    // 操作が増減しても控えの並びの幅が変わるので、それもここで拾える
    observer.observe(container)
    observer.observe(ghostRow)
    return () => observer.disconnect()
  }, [container, ghostRow])

  const visibleActions = actions.filter(
    (action) => !collapsedIds.has(action.id)
  )
  const collapsedActions = actions.filter((action) =>
    collapsedIds.has(action.id)
  )

  return (
    <div ref={setContainer} className="relative min-w-0 flex-1">
      {/*
        幅を測るためだけの控えの並び。**常に全部を並べたまま**にしておくことが要点で、
        畳んだ結果がここの寸法を変えない。`absolute` なので器の幅にも効かない。
        見えず触れず、読み上げにも拾わせない（`inert`）。
      */}
      <div
        ref={setGhostRow}
        aria-hidden
        inert
        className="pointer-events-none invisible absolute top-0 left-0 flex flex-nowrap items-center gap-2"
      >
        {actions.map((action) => (
          <div
            key={action.id}
            data-overflow-toolbar-ghost-item=""
            data-overflow-toolbar-id={action.id}
            className="shrink-0"
          >
            {action.node}
          </div>
        ))}
        {/*
          控えのほうには名前を付けない。ここは幅を測るためだけの姿で、名前があっても
          同じ `aria-label` が2つ在ることにしかならない（`aria-hidden` の外から
          名前で引くと、どちらを掴んだのか分からなくなる）
        */}
        <div data-overflow-toolbar-ghost-overflow="" className="shrink-0">
          <OverflowTriggerButton tabIndex={-1} />
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="一覧の操作"
        aria-orientation="horizontal"
        className="flex min-w-0 flex-nowrap items-center justify-end gap-2 overflow-hidden"
      >
        {visibleActions.map((action) => (
          <div key={action.id} className="shrink-0">
            {action.node}
          </div>
        ))}
        {collapsedActions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <OverflowTriggerButton aria-label="入りきらない操作" />
            </PopoverTrigger>
            {/*
              中身は `DropdownMenuItem` に包まずそのまま置く。`collapsedNode` は
              押したら閉じる項目とは限らず、絞り込みの一覧のように開いたまま操作する
              ものが入るため
            */}
            <PopoverContent align="end" className="w-64 space-y-2 p-2">
              {collapsedActions.map((action) => (
                <div key={action.id}>{action.collapsedNode}</div>
              ))}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
