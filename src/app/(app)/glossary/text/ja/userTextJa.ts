import type { UserTermId } from "../../categories/userCategory"
import type { GlossaryTermText } from "../../types"

export const USER_TEXT_JA: Record<UserTermId, GlossaryTermText> = {
  user: {
    label: "ユーザー",
    summary:
      "アプリにログインして採点する教員1人。ユーザー名と表示名を持ち、パスコードを任意で設定できる。",
    variants: ["利用者"],
    avoidedAliases: [],
    distinctions: {
      examMember:
        "メンバーは試験に参加している教員と、その試験での役割の組み合わせ。ユーザーは人そのもの。",
    },
  },
}
