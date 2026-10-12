// @vitest-environment jsdom
/**
 * 個人成績表の設定（設問の表）の「類型評価の見せ方」の3択の検査（docs/vlm-grading-design.md §4-8-8）。
 *
 * 押したら見せ方を `scaleValueDisplay` で書き、選択中のものをもう一度押しても外れない（空にならない）。
 */

import "@testing-library/jest-dom/vitest"

import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuestionSettingsSection } from "@/components/exams/09-export/components/individual-report-settings/QuestionSettingsSection"
import { DEFAULT_INDIVIDUAL_REPORT_OPTIONS } from "@/types/individualReport.types"

afterEach(cleanup)

describe("類型評価の見せ方", () => {
  it("既定は「A (8)」で、押した見せ方を書く", () => {
    const updateOption = vi.fn()
    render(
      <QuestionSettingsSection
        options={DEFAULT_INDIVIDUAL_REPORT_OPTIONS}
        updateOption={updateOption}
      />
    )

    expect(screen.getByRole("radio", { name: "記号と点数" })).toHaveAttribute(
      "aria-checked",
      "true"
    )

    fireEvent.click(screen.getByRole("radio", { name: "点数だけ" }))
    expect(updateOption).toHaveBeenCalledWith("scaleValueDisplay", "points")

    fireEvent.click(screen.getByRole("radio", { name: "記号だけ" }))
    expect(updateOption).toHaveBeenCalledWith("scaleValueDisplay", "label")
  })

  it("選択中のものをもう一度押しても書かない（外させない）", () => {
    const updateOption = vi.fn()
    render(
      <QuestionSettingsSection
        options={DEFAULT_INDIVIDUAL_REPORT_OPTIONS}
        updateOption={updateOption}
      />
    )

    fireEvent.click(screen.getByRole("radio", { name: "記号と点数" }))
    expect(updateOption).not.toHaveBeenCalled()
  })
})
