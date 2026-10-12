import { table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

export const TAG_TERM_IDS = ["tag"] as const
export type TagTermId = (typeof TAG_TERM_IDS)[number]

export const TAG_CATEGORY: GlossaryCategory<TagTermId> = {
  id: "tag",
  termIds: TAG_TERM_IDS,
  codeRefs: {
    tag: [
      table("Tag"),
      table("ExamTag"),
      table("CourseworkTag"),
      table("GradeTag"),
      table("AsbDefinitionTag"),
      table("TagSubtotalGroup"),
    ],
  },
}
