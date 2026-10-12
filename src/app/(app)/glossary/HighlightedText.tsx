/** 検索語に当たった箇所を塗る（大文字・小文字は区別しない） */
export function HighlightedText({
  text,
  normalizedQuery,
}: {
  text: string
  normalizedQuery: string
}) {
  if (normalizedQuery === "") return text

  const lowerText = text.toLowerCase()
  const segments: { start: number; isMatch: boolean; text: string }[] = []
  let cursor = 0
  while (cursor < text.length) {
    const matchStart = lowerText.indexOf(normalizedQuery, cursor)
    if (matchStart === -1) {
      segments.push({ start: cursor, isMatch: false, text: text.slice(cursor) })
      break
    }
    if (matchStart > cursor) {
      segments.push({
        start: cursor,
        isMatch: false,
        text: text.slice(cursor, matchStart),
      })
    }
    const matchEnd = matchStart + normalizedQuery.length
    segments.push({
      start: matchStart,
      isMatch: true,
      text: text.slice(matchStart, matchEnd),
    })
    cursor = matchEnd
  }

  return segments.map((segment) =>
    segment.isMatch ? (
      <mark
        key={segment.start}
        className="rounded-sm bg-yellow-200 text-inherit dark:bg-yellow-700/60"
      >
        {segment.text}
      </mark>
    ) : (
      <span key={segment.start}>{segment.text}</span>
    )
  )
}
