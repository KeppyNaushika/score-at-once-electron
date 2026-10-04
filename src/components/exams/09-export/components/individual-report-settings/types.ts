import type { IndividualReportOptions } from "@/types/individualReport.types"

/** 設定の1項目だけを差し替える（各節が共通で受け取る） */
export type UpdateReportOption = <K extends keyof IndividualReportOptions>(
  key: K,
  value: IndividualReportOptions[K]
) => void

/** 各節が受け取るもの */
export interface ReportSettingsSectionProps {
  options: IndividualReportOptions
  updateOption: UpdateReportOption
}
