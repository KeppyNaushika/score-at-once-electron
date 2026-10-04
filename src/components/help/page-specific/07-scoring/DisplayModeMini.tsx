/**
 * 模範解答の表示モードの図（答=生徒答案・模=模範解答）。
 * 模範解答が現れて消えるアニメーションで、表示の切り替えを表す。
 * 横幅3分割のグリッドに並べて使うため、列いっぱいに広がる。
 */
export function DisplayModeMini({
  mode,
}: {
  mode: "overlay" | "split-h" | "split-value"
}) {
  if (mode === "overlay") {
    return (
      <div className="relative flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded border border-gray-300 bg-white">
        <span className="text-2xl font-bold text-blue-900/70">答</span>
        <span
          className="absolute inset-0 flex items-center justify-center bg-rose-500/10 text-2xl font-bold text-rose-500/60"
          style={{ animation: "help07Master 4s infinite" }}
        >
          模
        </span>
      </div>
    )
  }
  if (mode === "split-h") {
    return (
      <div className="relative aspect-4/3 w-full overflow-hidden rounded border border-gray-300 bg-white">
        {/* 答案用紙：中央から左半分の中央へ寄る */}
        <div
          className="absolute inset-y-0 left-0 flex w-full items-center justify-center text-2xl font-bold text-blue-900/70"
          style={{ animation: "help07SheetH 4s infinite" }}
        >
          答
        </div>
        {/* 模範解答：右からスライドインして右半分に入る */}
        <div
          className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center border-l border-gray-300 bg-rose-50 text-2xl font-bold text-rose-500/70"
          style={{ animation: "help07MasterSlideH 4s infinite" }}
        >
          模
        </div>
      </div>
    )
  }
  return (
    <div className="relative aspect-4/3 w-full overflow-hidden rounded border border-gray-300 bg-white">
      {/* 答案用紙：中央から上半分の中央へ寄る */}
      <div
        className="absolute inset-x-0 top-0 flex h-full items-center justify-center text-2xl font-bold text-blue-900/70"
        style={{ animation: "help07SheetV 4s infinite" }}
      >
        答
      </div>
      {/* 模範解答：下からスライドインして下半分に入る */}
      <div
        className="absolute inset-x-0 bottom-0 flex h-1/2 items-center justify-center border-t border-gray-300 bg-rose-50 text-2xl font-bold text-rose-500/70"
        style={{ animation: "help07MasterSlideV 4s infinite" }}
      >
        模
      </div>
    </div>
  )
}
