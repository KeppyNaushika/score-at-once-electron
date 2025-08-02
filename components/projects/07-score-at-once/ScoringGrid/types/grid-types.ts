import type { ScoringData } from "@/components/projects/07-score-at-once/types"

// CropRegionWithProjectPage, PageImageWithProjectStudents を使用
export type GridAnswerItem = ScoringData & { isSelected?: boolean }
