import type { User } from "@prisma/client"
import bcrypt from "bcrypt"

import { diffFields, recordAuditLog } from "./auditLog"
import prisma from "./client"

/**
 * renderer へ渡してよいユーザーの形。
 *
 * **`passcode` を落とす。** 中身は bcrypt ハッシュで、画面が使う場面は無い
 * （照合は `verify-passcode` が main 側で行う）。かつては行をそのまま返しており、
 * 画面側の手書き `interface User` が6箇所でその事実を隠していた。
 */
const PUBLIC_USER_OMIT = { passcode: true } as const

/** 秘密を含まないユーザー1件 */
type PublicUser = Omit<User, "passcode">

export const fetchUsers = async (): Promise<PublicUser[]> => {
  try {
    return await prisma.user.findMany({ omit: PUBLIC_USER_OMIT })
  } catch (error) {
    console.error("Failed to fetch users:", error)
    throw error
  }
}

export const createUser = async (userData: {
  username: string
  name: string
  passcode?: string
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
}): Promise<PublicUser> => {
  try {
    const hashedPasscode =
      userData.passcode && userData.passcodeType !== "none"
        ? await bcrypt.hash(userData.passcode, 10)
        : null

    const user = await prisma.user.create({
      omit: PUBLIC_USER_OMIT,
      data: {
        username: userData.username,
        name: userData.name,
        passcode: hashedPasscode,
        passcodeType: userData.passcodeType || "none",
      },
    })

    await recordAuditLog({
      action: "user.create",
      entityType: "User",
      entityId: user.id,
      target: user.name,
    })

    return user
  } catch (error) {
    console.error("Failed to create user:", error)
    throw error
  }
}

export const verifyPasscode = async (
  userId: string,
  passcode: string
): Promise<boolean> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })

    if (!user || !user.passcode || user.passcodeType === "none") {
      return true // パスコードが設定されていない場合は認証成功
    }

    return await bcrypt.compare(passcode, user.passcode)
  } catch (error) {
    console.error("Failed to verify passcode:", error)
    return false
  }
}

export const updateUser = async (
  userId: string,
  userData: {
    username?: string
    name?: string
  }
): Promise<PublicUser> => {
  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
    })

    const user = await prisma.user.update({
      omit: PUBLIC_USER_OMIT,
      where: { id: userId },
      data: {
        ...(userData.username && { username: userData.username }),
        ...(userData.name && { name: userData.name }),
      },
    })

    await recordAuditLog({
      action: "user.update",
      entityType: "User",
      entityId: user.id,
      target: user.name,
      changes: diffFields(before ?? undefined, user, [
        { field: "name", label: "名前" },
        { field: "username", label: "ユーザー名" },
      ]),
    })

    return user
  } catch (error) {
    console.error("Failed to update user:", error)
    throw error
  }
}

export const updateUserPasscode = async (
  userId: string,
  passcode?: string,
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
): Promise<PublicUser> => {
  try {
    const hashedPasscode =
      passcode && passcodeType !== "none"
        ? await bcrypt.hash(passcode, 10)
        : null

    const user = await prisma.user.update({
      omit: PUBLIC_USER_OMIT,
      where: { id: userId },
      data: {
        passcode: hashedPasscode,
        passcodeType: passcodeType || "none",
      },
    })

    // 監査ログ: パスコード変更（パスコード値そのものは記録しない）
    await recordAuditLog({
      action: "user.update",
      entityType: "User",
      entityId: user.id,
      target: user.name,
      summary: `ユーザー「${user.name}」のパスコードを変更しました`,
    })

    return user
  } catch (error) {
    console.error("Failed to update user passcode:", error)
    throw error
  }
}
