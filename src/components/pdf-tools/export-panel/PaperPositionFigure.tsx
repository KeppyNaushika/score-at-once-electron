import { cn } from "@/lib/utils"

import type { PaperFigure } from "./pagePlacements"

interface PaperPositionFigureProps {
  figure: PaperFigure
  /** 図が示す位置の読み上げ */
  label: string
}

/**
 * 出力用紙の小さな図。同じ出力ページに載るページの外形を薄く描き、このページだけを塗る。
 *
 * 格子のマスでなく、出力と同じ計算で出したページの外形を描く。全体 N-up では
 * ファイルごとの面が1スロットへ縮んで入るので、格子1段ではどこに来るかを言えない
 * （上下に重なった2枚の片方、スロットの中央に縮んだ1枚など）。外形なら入れ子でも
 * そのまま見える。バッジの番号は読む順なので、並べ方を変えても番号は同じまま、塗る
 * 外形だけが動く。用紙の向きも図の縦横（A4 の縦横比）で見せる。
 */
export default function PaperPositionFigure({
  figure,
  label,
}: PaperPositionFigureProps) {
  const isLandscape = figure.paper.width > figure.paper.height
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "block shrink-0 rounded-[2px] border border-primary-foreground/70 p-px",
        isLandscape ? "h-4 w-5.5" : "h-5.5 w-4"
      )}
    >
      {/* 隣り合う外形が1つに見えないよう、外形の縁をバッジの地の色で1px描いて隙間にする */}
      <svg
        viewBox={`0 0 ${figure.paper.width} ${figure.paper.height}`}
        preserveAspectRatio="none"
        className="block size-full"
      >
        {figure.pageRects.map(({ pageId, rect }) => (
          <rect
            key={pageId}
            x={rect.x}
            y={rect.yTop}
            width={rect.width}
            height={rect.height}
            vectorEffect="non-scaling-stroke"
            strokeWidth={1}
            className={cn(
              "stroke-primary",
              pageId === figure.targetPageId
                ? "fill-primary-foreground"
                : "fill-primary-foreground/25"
            )}
          />
        ))}
      </svg>
    </span>
  )
}
