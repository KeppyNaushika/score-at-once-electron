import { column, table } from "../codeRefBuilders"
import type { GlossaryCategory } from "../types"

export const USER_TERM_IDS = ["user"] as const
export type UserTermId = (typeof USER_TERM_IDS)[number]

export const USER_CATEGORY: GlossaryCategory<UserTermId> = {
  id: "user",
  termIds: USER_TERM_IDS,
  codeRefs: {
    user: [table("User"), column("User", "username"), column("User", "name")],
  },
}
