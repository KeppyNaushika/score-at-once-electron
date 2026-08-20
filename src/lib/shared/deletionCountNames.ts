/**
 * 削除で巻き添えになるものの「数えたものの名前」（docs/remaining-work.md 段階26）。
 *
 * 確認ダイアログに出す文言であると同時に、main が消す直前に数え直した結果と
 * 突き合わせるときの鍵でもある。renderer が数える経路（試験の削除・模範解答ページの
 * 削除）と main が数える経路（答案・受験生徒・学級）の両方があるため、**両側が値で
 * 引ける場所に1つだけ置く**（docs/coding-style.md「同じ結果を出す計算は
 * `src/lib/shared/` へ」）。
 *
 * 名前を書き換えると突き合わせの鍵も変わる。ここを直すときは、その名前を作る側と
 * 数え直す側の両方を同時に直すこと。
 */
export const DELETION_COUNT_NAME = {
  /** 答案1枚の採点実績（06 の答案削除） */
  scoredQuestion: "採点済みの設問",
  scoreDecision: "確定した点数",
  drawingAnnotation: "答案への書き込み",
  scoredCompoundAnswer: "採点済みの複合回答",
  /** 受験生徒を試験から外すときに消える採点データ（05 の生徒削除） */
  gradingData: "採点データ",
  /** 学級を外すときに一緒に消える、その学級にのみ所属する生徒（成績・資料） */
  exclusiveStudent: "この学級にのみ所属する生徒",
  /** 試験の削除で消えるもの */
  masterAnswer: "模範解答",
  cropRegion: "採点領域",
  answerSheet: "答案",
  gradeDataSource: "参照している成績データソース",
  /** 模範解答ページの削除で一緒に消える答案（01 のページ削除） */
  pageAnswerSheet: "このページの答案",
} as const
