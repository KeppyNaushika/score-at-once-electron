import { useAnswerSelection } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerSelection"
import { useAnswerWhiteness } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useAnswerWhiteness"
import { useScoringFilter } from "@/components/exams/07-score-at-once/ScoringMain/hooks/useScoringFilter"

type UseScoringAnswerListOptions = Omit<
  Parameters<typeof useScoringFilter>[0],
  "whitenessByAnswerId" | "isWhitenessPending"
> & {
  /** 一覧に表示しているページ（白さを先読みする対象） */
  currentExamPageId: string | null
  replaceSelection: (answerIds: string[]) => void
}

/**
 * 採点画面（07）の一覧に出す答案。白さ順・濃さ順のための白さの先読み、
 * 採点状態での絞り込みと並び、答案の選択の口をまとめて返す。
 */
export function useScoringAnswerList({
  currentExamPageId,
  replaceSelection,
  ...filterOptions
}: UseScoringAnswerListOptions) {
  const { studentAnswerImages, cropRegions, gradingMode, answerSortOrder } =
    filterOptions

  /** 白さ順ソート用: 一覧表示中のページの白さを先読みする */
  const { whitenessByAnswerId, isWhitenessReady } = useAnswerWhiteness({
    studentAnswerImages,
    cropRegions,
    currentExamPageId,
    enabled: gradingMode === "grid",
  })

  /**
   * 白さ順・濃さ順は、並べる材料が揃うまで答案を出さない（表示も選択もしない）。
   * 表示順で並べて見せておくと、算出が終わった瞬間に並びが総入れ替えになり、
   * 見ていた答案と操作の対象がずれる。並び順は利用者ごとに憶えているので、
   * 常用している人は一覧を開いた時点でこの状態から始まる。
   */
  const isWhitenessPending =
    gradingMode === "grid" &&
    (answerSortOrder === "whiteness" || answerSortOrder === "darkness") &&
    !isWhitenessReady

  /** フィルタリング管理hook */
  const scoringFilter = useScoringFilter({
    ...filterOptions,
    whitenessByAnswerId,
    isWhitenessPending,
  })

  const { handleReplaceSelection, handleSelectAll, handleSelectUnscored } =
    useAnswerSelection({
      allScoringData: scoringFilter.allScoringData,
      filteredScoringDataIds: scoringFilter.filteredScoringDataIds,
      filterSettings: scoringFilter.filterSettings,
      handleToggleFilter: scoringFilter.handleToggleFilter,
      replaceSelection,
    })

  return {
    ...scoringFilter,
    isWhitenessReady,
    isWhitenessPending,
    handleReplaceSelection,
    handleSelectAll,
    handleSelectUnscored,
  }
}
