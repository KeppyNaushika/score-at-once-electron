import { column, identifier, table, value } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

const GRADE_TYPES = "src/types/grade.types.ts"

export const GRADE_TERM_IDS = [
  "grade",
  "gradeReferenceDate",
  "gradeClassroom",
  "gradeStudent",
  "gradeItem",
  "gradeDataSource",
  "dataSourceExamTotal",
  "dataSourceSubtotal",
  "dataSourceCropRegion",
  "dataSourceCoursework",
  "dataSourceCourseworkTotal",
  "convertedMaxScore",
  "absentEstimation",
  "estimationSource",
  "gradeItemExclusion",
  "gradeItemBoundary",
  "gradeLabel",
  "gradeConstraint",
  "constraintConsistency",
  "constraintMutualExclusion",
  "constraintExpression",
  "gradeOverride",
  "gradeFrozenScore",
  "gradeComparison",
  "gradeExportComparison",
  "gradeIndividualReport",
  "gradeLock",
] as const
export type GradeTermId = (typeof GRADE_TERM_IDS)[number]

export const GRADE_CATEGORY: GlossaryCategory<GradeTermId> = {
  id: "grade",
  termIds: GRADE_TERM_IDS,
  codeRefs: {
    grade: [table("Grade"), column("Grade", "name")],
    gradeReferenceDate: [column("Grade", "referenceDate")],
    gradeClassroom: [table("GradeClassroom")],
    gradeStudent: [table("GradeStudent")],
    gradeItem: [table("GradeItem"), column("GradeItem", "name")],
    gradeDataSource: [
      table("GradeDataSource"),
      column("GradeDataSource", "type"),
    ],
    dataSourceExamTotal: [
      value("GradeDataSource", "type", "exam_total", GRADE_TYPES),
      column("GradeDataSource", "examId"),
    ],
    dataSourceSubtotal: [
      value("GradeDataSource", "type", "subtotal", GRADE_TYPES),
      column("GradeDataSource", "subtotalId"),
    ],
    dataSourceCropRegion: [
      value("GradeDataSource", "type", "crop_region", GRADE_TYPES),
      column("GradeDataSource", "cropRegionId"),
    ],
    dataSourceCoursework: [
      value("GradeDataSource", "type", "coursework", GRADE_TYPES),
      column("GradeDataSource", "courseworkItemId"),
    ],
    dataSourceCourseworkTotal: [
      value("GradeDataSource", "type", "coursework_total", GRADE_TYPES),
      column("GradeDataSource", "courseworkId"),
    ],
    convertedMaxScore: [column("GradeDataSource", "weight")],
    absentEstimation: [
      column("GradeDataSource", "absentMethod"),
      column("GradeDataSource", "absentRatio"),
      column("GradeDataSource", "absentOffset"),
      column("GradeDataSource", "treatExpectedAsMissing"),
      identifier("AbsentMethod", GRADE_TYPES),
    ],
    estimationSource: [
      table("GradeDataSourceEstimationSource"),
      value("GradeDataSource", "estimationMode", "selected", GRADE_TYPES),
    ],
    gradeItemExclusion: [table("GradeItemExclusion")],
    gradeItemBoundary: [
      table("GradeItemBoundary"),
      column("GradeItemBoundary", "minPercentage"),
    ],
    gradeLabel: [
      column("GradeItemBoundary", "label"),
      column("GradeOverride", "overrideLabel"),
      column("GradeFrozenScore", "gradeLabel"),
    ],
    gradeConstraint: [
      table("GradeConstraint"),
      column("GradeConstraint", "kind"),
    ],
    constraintConsistency: [
      value("GradeConstraint", "kind", "consistency", GRADE_TYPES),
      table("GradeConstraintViewpoint"),
      table("GradeConstraintLabelValue"),
      column("GradeConstraint", "tolerance"),
    ],
    constraintMutualExclusion: [
      value("GradeConstraint", "kind", "mutual_exclusion", GRADE_TYPES),
      table("GradeConstraintExclusionLabel"),
    ],
    constraintExpression: [
      value("GradeConstraint", "kind", "expression", GRADE_TYPES),
      column("GradeConstraint", "expression"),
    ],
    gradeOverride: [table("GradeOverride")],
    gradeFrozenScore: [table("GradeFrozenScore")],
    gradeComparison: [
      table("GradeComparison"),
      column("GradeComparison", "comparedGradeItemId"),
    ],
    gradeExportComparison: [
      table("GradeExportComparison"),
      column("GradeExportComparison", "enabled"),
    ],
    gradeIndividualReport: [table("GradeIndividualReportSettings")],
    gradeLock: [
      identifier(
        "GRADE_WRITE_LOCKED_MESSAGE",
        "src/lib/shared/gradeWriteLock.ts"
      ),
    ],
  },
}
