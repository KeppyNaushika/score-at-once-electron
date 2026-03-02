/**
 * ユーザーマッチングロジック
 */

import type { UserMatchingMethod } from "../../../../../types/examArchive.types"
import prisma from "../../../prisma/client"
import type { ExtractedArchiveData } from "../../exam-archive/archiveExtractor"
import type { MatchResult, UserData } from "./types"

/**
 * ユーザーデータのマッチングを実行
 *
 * 照合の流れ:
 * 1. まずUUIDで照合
 * 2. UUIDが一致しない場合、methodで指定された二次照合を実行
 */
export async function matchUsers(
  importData: ExtractedArchiveData,
  method: UserMatchingMethod
): Promise<MatchResult<UserData>[]> {
  const results: MatchResult<UserData>[] = []

  const existingUsers = await prisma.user.findMany()

  for (const importUser of importData.usersData.users) {
    let matchedUser: (typeof existingUsers)[0] | null = null
    let isExactMatch = false

    // Step 1: UUIDで照合
    const uuidMatch = existingUsers.find((u) => u.id === importUser.id)
    if (uuidMatch) {
      matchedUser = uuidMatch
      isExactMatch = true
    }

    // Step 2: UUIDが一致しない場合、二次照合を実行
    if (!matchedUser && method !== "none") {
      switch (method) {
        case "username":
          matchedUser =
            existingUsers.find((u) => u.username === importUser.username) ??
            null
          break
      }
    }

    results.push({
      importData: {
        id: importUser.id,
        username: importUser.username,
        name: importUser.name,
        role: importUser.role,
        updatedAt: importUser.updatedAt,
      },
      existingData: matchedUser
        ? {
            id: matchedUser.id,
            username: matchedUser.username,
            name: matchedUser.name,
            role: matchedUser.role,
            updatedAt: matchedUser.updatedAt,
          }
        : null,
      matchType: matchedUser ? (isExactMatch ? "exact" : "fuzzy") : "new",
    })
  }

  return results
}
