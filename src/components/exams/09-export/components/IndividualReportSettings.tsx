"use client"

import type { IndividualReportOptions } from "@/types/individualReport.types"

import { QuestionSettingsSection } from "./individual-report-settings/QuestionSettingsSection"
import {
  OptionCard,
  Section,
} from "./individual-report-settings/ReportOptionControls"
import { StatisticsSettingsSection } from "./individual-report-settings/StatisticsSettingsSection"
import { SubtotalSettingsSection } from "./individual-report-settings/SubtotalSettingsSection"
import type { UpdateReportOption } from "./individual-report-settings/types"

interface IndividualReportSettingsProps {
  examId: string
  options: IndividualReportOptions
  onChange: (options: IndividualReportOptions) => void
}

export function IndividualReportSettings({
  examId,
  options,
  onChange,
}: IndividualReportSettingsProps) {
  const updateOption: UpdateReportOption = (key, value) => {
    onChange({ ...options, [key]: value })
  }

  return (
    <div className="space-y-6">
      {/* 基本表示/統計情報 */}
      <StatisticsSettingsSection
        options={options}
        updateOption={updateOption}
      />

      {/* 小計点関連 */}
      <SubtotalSettingsSection
        examId={examId}
        options={options}
        updateOption={updateOption}
      />

      {/* 設問関連 */}
      <QuestionSettingsSection options={options} updateOption={updateOption} />

      {/* 行政要素 */}
      <Section title="行政要素">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <OptionCard
            label="コメント欄"
            checked={options.showComment}
            onChange={(value) => updateOption("showComment", value)}
          />
          <OptionCard
            label="署名・押印欄"
            checked={options.showSignature}
            onChange={(value) => updateOption("showSignature", value)}
          />
        </div>
      </Section>
    </div>
  )
}
