/**
 * 出力設定を「変わった行」へ割る計算のテスト。
 *
 * 出力設定は6テーブルに分かれている。以前は打鍵1回で設定一式を送り、main が
 * 20行以上を1つの `$transaction` で upsert していた。ここが割り方を間違えると、
 * 書いたつもりの設定が保存されない（落とす）か、関係ない行まで触る（膨らむ）。
 *
 * **落とすほうが害が大きい**ので、判断できないものは「書く」へ倒してある。
 */

import { describe, expect, it } from "vitest"

import {
  answerOverlayChanges,
  individualReportChanges,
} from "@/components/exams/09-export/utils/exportSettingChanges"
import { DEFAULT_INDIVIDUAL_REPORT_OPTIONS } from "@/types/individualReport.types"
import { DEFAULT_ANSWER_OVERLAY_SETTINGS } from "@/types/scoringOverlay.types"

/** DB から読んだ体の重ね描き設定（既定値と違い、実在する行の id と時刻を持つ） */
function storedOverlaySettings() {
  const stored = structuredClone(DEFAULT_ANSWER_OVERLAY_SETTINGS)
  for (const style of Object.values(stored.styles)) {
    style.id = `style-${style.overlayKind}`
    style.examId = "exam-1"
    style.createdAt = new Date("2026-01-01T00:00:00.000Z")
    style.updatedAt = new Date("2026-01-02T00:00:00.000Z")
  }
  for (const visibility of Object.values(stored.visibility)) {
    visibility.id = `visibility-${visibility.status}`
    visibility.examId = "exam-1"
    visibility.createdAt = new Date("2026-01-01T00:00:00.000Z")
    visibility.updatedAt = new Date("2026-01-02T00:00:00.000Z")
  }
  return stored
}

describe("出力設定を行へ割る", () => {
  describe("重ね描き設定", () => {
    it("何も変わっていなければ1件も出ない", () => {
      const stored = storedOverlaySettings()

      expect(answerOverlayChanges(stored, structuredClone(stored))).toEqual([])
    })

    it("同定と履歴の違いは変更として数えない（既定値の行はidも時刻も別物）", () => {
      // 既定値の行は `default:mark` のような偽の id と epoch の時刻を持つ。
      // そこを見ると「何も変えていないのに全行書き直す」ことになる
      expect(
        answerOverlayChanges(
          storedOverlaySettings(),
          DEFAULT_ANSWER_OVERLAY_SETTINGS
        )
      ).toEqual([])
    })

    it("1種別の色を変えたら、その行だけが出る", () => {
      const previous = storedOverlaySettings()
      const next = structuredClone(previous)
      next.styles.mark.color = "#123456"

      const changes = answerOverlayChanges(previous, next)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({
        kind: "overlayStyle",
        style: next.styles.mark,
      })
    })

    it("1つの採点状態の可視性を変えたら、その行だけが出る", () => {
      const previous = storedOverlaySettings()
      const next = structuredClone(previous)
      next.visibility.correct.showScore = !next.visibility.correct.showScore

      const changes = answerOverlayChanges(previous, next)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({
        kind: "overlayVisibility",
        visibility: next.visibility.correct,
      })
    })

    it("既定へ戻すと、値が違う行が全部出る", () => {
      const previous = storedOverlaySettings()
      previous.styles.mark.color = "#123456"
      previous.styles.total.size = 99
      previous.visibility.correct.showMark = false

      const changes = answerOverlayChanges(
        previous,
        DEFAULT_ANSWER_OVERLAY_SETTINGS
      )

      expect(changes.map((change) => change.kind).sort()).toEqual([
        "overlayStyle",
        "overlayStyle",
        "overlayVisibility",
      ])
    })
  })

  describe("個人成績表の設定", () => {
    const stored = DEFAULT_INDIVIDUAL_REPORT_OPTIONS

    it("何も変わっていなければ1件も出ない", () => {
      expect(individualReportChanges(stored, structuredClone(stored))).toEqual(
        []
      )
    })

    it("設定本体の項目を変えたら、設定の行だけが出る", () => {
      const next = structuredClone(stored)
      next.showComment = !next.showComment

      const changes = individualReportChanges(stored, next)

      expect(changes).toHaveLength(1)
      expect(changes[0].kind).toBe("reportSettings")
    })

    it("表の節のフォントサイズを変えたら、その節の行だけが出る", () => {
      const next = structuredClone(stored)
      next.subtotalTableFontSize = next.subtotalTableFontSize + 1

      const changes = individualReportChanges(stored, next)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({
        kind: "reportTableSection",
        tableKind: "subtotal",
        values: {
          enabled: next.showSubtotalTable,
          columns: next.subtotalTableColumns,
          fontSize: next.subtotalTableFontSize,
        },
      })
    })

    it("グラフの項目を変えたら、グラフの行だけが出る", () => {
      const next = structuredClone(stored)
      next.graphOptions.showRadarChart = !next.graphOptions.showRadarChart

      const changes = individualReportChanges(stored, next)

      expect(changes).toHaveLength(1)
      expect(changes[0].kind).toBe("reportGraphSettings")
    })

    it("統計の1マスを変えたら、そのマスだけが出る", () => {
      const next = structuredClone(stored)
      const shown = !next.statistics.average.classroom
      next.statistics.average.classroom = shown

      const changes = individualReportChanges(stored, next)

      expect(changes).toHaveLength(1)
      expect(changes[0]).toEqual({
        kind: "statisticVisibility",
        statisticKind: "average",
        scope: "classroom",
        shown,
      })
    })

    it("選んだ小計点グループの id だけが変わっても、設定の行は書かない", () => {
      // 選択の正本は ExamSubtotalGroup のフラグ。設定の行が持つのは
      // 「絞り込みを使うか」だけなので、id が動いてもこの6テーブルは変わらない
      const next = structuredClone(stored)
      next.tableSubtotalGroupSelection.selectedGroupIds = ["group-1"]
      next.boxPlotSubtotalGroupSelection.selectedGroupIds = ["group-2"]

      expect(individualReportChanges(stored, next)).toEqual([])
    })

    it("絞り込みを使うかの切り替えは、設定の行とグラフの行へ分かれる", () => {
      const next = structuredClone(stored)
      next.tableSubtotalGroupSelection.enabled =
        !next.tableSubtotalGroupSelection.enabled
      next.boxPlotSubtotalGroupSelection.enabled =
        !next.boxPlotSubtotalGroupSelection.enabled

      const changes = individualReportChanges(stored, next)

      expect(changes.map((change) => change.kind).sort()).toEqual([
        "reportGraphSettings",
        "reportSettings",
      ])
    })

    it("入れ子の設定（学習アドバイス）の変更も設定の行として拾う", () => {
      const next = structuredClone(stored)
      next.adviceOptions.reviewQuestionCount =
        (next.adviceOptions.reviewQuestionCount ?? 0) + 1

      const changes = individualReportChanges(stored, next)

      expect(changes).toHaveLength(1)
      expect(changes[0].kind).toBe("reportSettings")
    })
  })
})
