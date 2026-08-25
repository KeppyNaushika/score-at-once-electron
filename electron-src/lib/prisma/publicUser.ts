import type { User } from "@prisma/client"

/**
 * 画面へ渡してよいユーザーの形。
 *
 * **`passcode` を落とす。** 中身は bcrypt ハッシュで、画面が使う場面は無い
 * （照合は `verify-passcode` が main 側で行う）。
 *
 * **`user.ts` の中だけに置いていたのが漏れの元だった。** ユーザーの行は
 * `include: { user: true }` でも付いてくる（採点者・招待者・担当者・所有者）ので、
 * 1件ずつ引くところだけを直しても、連れてくる経路14箇所からは素通りしていた。
 * ここへ出して、User の行を引く全員が同じものを使う。**新しい経路を足したときに
 * 忘れないよう、`__tests__/renderer/publicUserOmit.test.ts` が素の `user: true` を
 * 見張っている。**
 */
export const PUBLIC_USER_OMIT = { passcode: true } as const

/** 秘密を含まないユーザー1件 */
export type PublicUser = Omit<User, "passcode">
