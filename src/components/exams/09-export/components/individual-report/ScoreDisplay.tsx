/** 得点/配点の表示コンポーネント。得点は数のほか、類型評価の「A (8)」のような文字も受け取る */
export function ScoreDisplay({
  score,
  maxScore,
  fontSize,
}: {
  score: number | string | null
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
