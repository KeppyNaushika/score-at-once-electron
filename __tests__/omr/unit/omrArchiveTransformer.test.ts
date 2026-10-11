/**
 * 旧 .score アーカイブの OMR 設定の読み込み（V1.6.0 → V1.7.0 変換器）
 *
 * v1.6.0 以前のアーカイブには OMR 設定の欄が無い。取り込みが欄の無いことで
 * 落ちないよう、変換器が空の配列で補う。
 */

import { describe, expect, it } from "vitest"

import { V1_6_0_to_V1_7_0_Transformer } from "../../../electron-src/lib/import/transformers/V1_6_0_to_V1_7_0"

/** v1.6.0 形式のデータ（omrConfigs/omrChoiceOptions なし） */
function createV1_6_0_Data() {
  return {
    manifest: { version: "1.6.0", exportedAt: "", appVersion: "" },
    examData: {
      exam: { id: "test", examName: "test", createdAt: "", updatedAt: "" },
      examPages: [],
      cropRegions: [],
      pageImages: [],
      examStudents: [],
      userExams: [],
      examSubtotalGroups: [],
      masterImages: [],
      studentAnswerImages: [],
    },
    studentsData: { students: [] },
    classesData: { classes: [], memberships: [] },
    usersData: { users: [] },
    subtotalsData: {
      subtotalGroups: [],
      subtotals: [],
      cropSubtotals: [],
    },
    scoresData: { questionScores: [], drawingAnnotations: [] },
  }
}

describe("V1.6.0→V1.7.0 トランスフォーマー", () => {
  it("omrConfigs/omrChoiceOptions が未定義のデータに空配列を追加する", () => {
    const transformer = new V1_6_0_to_V1_7_0_Transformer()

    const result = transformer.transform(createV1_6_0_Data() as never)

    expect(result.data.manifest.version).toBe("1.7.0")
    expect(result.data.examData.omrConfigs).toEqual([])
    expect(result.data.examData.omrChoiceOptions).toEqual([])
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  it("既に OMR 設定を持つデータは、その中身を捨てない", () => {
    const transformer = new V1_6_0_to_V1_7_0_Transformer()
    const data = createV1_6_0_Data()
    const omrConfigs = [{ id: "omr-config-1", cropRegionId: "region-1" }]
    const omrChoiceOptions = [{ id: "option-1", omrConfigId: "omr-config-1" }]

    const result = transformer.transform({
      ...data,
      examData: { ...data.examData, omrConfigs, omrChoiceOptions },
    } as never)

    expect(result.data.examData.omrConfigs).toEqual(omrConfigs)
    expect(result.data.examData.omrChoiceOptions).toEqual(omrChoiceOptions)
  })
})
