import { REGION_GREEN } from "./constants"

/** 答案用紙のダミー行（手書きを模した薄いプレースホルダ） */
function SheetLine({ label, widths }: { label: string; widths: string[] }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 w-3 shrink-0 text-[10px] text-gray-400">
        {label}
      </span>
      <div className="flex flex-1 flex-col gap-1.5 py-0.5">
        {widths.map((width, i) => (
          <span
            key={i}
            className="block h-2 rounded-sm bg-gray-200"
            style={{ width }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 答案用紙1枚。本番の「左右分割」では、生徒の答案用紙と模範解答の答案用紙を
 * 同じサイズ・同じレイアウトで横に並べる。生徒用は採点マーク・点数を重ね、
 * 模範解答用はそれらを出さない。
 */
export function IndividualSheet({
  headerRight,
  answer,
  answerClassName,
  mark,
  markColor,
  score,
}: {
  headerRight: React.ReactNode
  answer: string
  answerClassName: string
  mark?: string
  markColor?: string
  score?: string | null
}) {
  return (
    <div className="relative w-60 rounded-sm border border-gray-300 bg-white px-4 py-3 shadow-sm">
      {/* 用紙ヘッダー */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-200 pb-1.5">
        <span className="text-[11px] font-medium text-gray-600">
          {"国語　答案用紙"}
        </span>
        <span className="text-[11px] text-gray-500">{headerRight}</span>
      </div>

      <div className="space-y-3">
        <SheetLine label="一" widths={["90%", "70%"]} />
        <SheetLine label="二" widths={["80%"]} />

        {/* いま採点する領域＝緑の枠。本番と同じく枠の上に緑のラベル。 */}
        <div>
          <span
            className="ml-1 text-[10px] font-bold"
            style={{ color: REGION_GREEN }}
          >
            {"三　「きぼう」を漢字で"}
          </span>
          <div
            className="relative rounded-sm border-2 bg-white px-2 py-1.5"
            style={{ borderColor: REGION_GREEN }}
          >
            <div
              className={`flex h-10 items-center text-3xl ${answerClassName}`}
              style={{ fontFamily: "cursive" }}
            >
              {answer}
            </div>
            {mark && (
              <span
                className="pointer-events-none absolute top-1 right-2 text-5xl leading-none"
                style={{ color: markColor, transform: "rotate(-8deg)" }}
              >
                {mark}
              </span>
            )}
            {score && (
              <span
                className="absolute right-2 bottom-1 text-xs font-bold"
                style={{ color: markColor }}
              >
                {score}
              </span>
            )}
          </div>
        </div>

        <SheetLine label="四" widths={["85%", "60%"]} />
      </div>
    </div>
  )
}
