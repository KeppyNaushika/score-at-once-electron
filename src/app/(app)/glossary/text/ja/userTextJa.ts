import type { UserTermId } from "../../categories/userCategory"
import type { GlossaryTermText } from "../../types"

export const USER_TEXT_JA: Record<UserTermId, GlossaryTermText> = {
  user: {
    label: "ユーザー",
    summary:
      "アプリにログインして採点する教員1人。ユーザー名と表示名を持ち、パスコードを任意で設定できる。",
    variants: [],
    avoidedAliases: ["利用者"],
    distinctions: {
      examMember:
        "メンバーは試験に参加している教員と、その試験での権限の組み合わせ。ユーザーは人そのもの。",
    },
  },
}
