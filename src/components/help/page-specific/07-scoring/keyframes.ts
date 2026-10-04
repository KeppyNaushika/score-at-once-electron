// 採点スタイルの説明アニメーション（CSS / SVG）で使う keyframes。
// 本体（HelpContent07Scoring）が <style> で1回だけ描画する。

export const HELP07_KEYFRAMES = `
@keyframes help07Sel {
  0%, 100% { border-color: #e5e7eb; }
  6% { border-color: var(--help07-sel, #F97316); }
  18% { border-color: #e5e7eb; }
}
@keyframes help07Mark {
  0%, 10% { opacity: 0; transform: scale(0.4); }
  20% { opacity: 1; transform: scale(1); }
  90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes help07Pen {
  0% { stroke-dashoffset: var(--help07-len); opacity: 1; }
  45%, 80% { stroke-dashoffset: 0; opacity: 1; }
  95% { stroke-dashoffset: 0; opacity: 0; }
  100% { stroke-dashoffset: var(--help07-len); opacity: 0; }
}
@keyframes help07March { to { stroke-dashoffset: -14; } }
@keyframes help07Pan {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(7px); }
}
/* 緑枠が設問を1つずつ下へ移る */
@keyframes help07FrameDown {
  0%, 22% { transform: translateY(0); }
  33%, 55% { transform: translateY(24px); }
  66%, 100% { transform: translateY(48px); }
}
/* 3つの要素を順番に1つずつ表示（生徒が次々と変わる） */
@keyframes help07Show3 {
  0% { opacity: 0; }
  3%, 30% { opacity: 1; }
  33%, 100% { opacity: 0; }
}
/* 模範解答が現れて消える（オーバーレイの説明図） */
@keyframes help07Master {
  0%, 12% { opacity: 0; }
  28%, 72% { opacity: 1; }
  88%, 100% { opacity: 0; }
}
/* 模範解答が右からスライドイン／アウト（左右分割の説明図） */
@keyframes help07MasterSlideH {
  0%, 12% { transform: translateX(100%); }
  28%, 72% { transform: translateX(0); }
  88%, 100% { transform: translateX(100%); }
}
/* 模範解答が下からスライドイン／アウト（上下分割の説明図） */
@keyframes help07MasterSlideV {
  0%, 12% { transform: translateY(100%); }
  28%, 72% { transform: translateY(0); }
  88%, 100% { transform: translateY(100%); }
}
/* 答案用紙の中央が左半分の中央へ寄る（左右分割の説明図） */
@keyframes help07SheetH {
  0%, 12% { transform: translateX(0); }
  28%, 72% { transform: translateX(-25%); }
  88%, 100% { transform: translateX(0); }
}
/* 答案用紙の中央が上半分の中央へ寄る（上下分割の説明図） */
@keyframes help07SheetV {
  0%, 12% { transform: translateY(0); }
  28%, 72% { transform: translateY(-25%); }
  88%, 100% { transform: translateY(0); }
}
`
