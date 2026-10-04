/** 得点/配点の表示コンポーネント */
export function ScoreDisplay({
  score,
  maxScore,
  fontSize,
}: {
  score: number | null
  maxScore: number
  fontSize: number
}) {
  return (
    <span>
      {score ?? "-"}
      <span style={{ fontSize: `${fontSize * 0.8}px`, color: "#666" }}>
        {" "}
        / {maxScore}
      </span>
    </span>
  )
}
