import { User } from "@prisma/client"
import bcrypt from "bcrypt"

import prisma from "./client"

export const fetchUsers = async (): Promise<User[]> => {
  try {
    return await prisma.user.findMany()
  } catch (error) {
    console.error("Failed to fetch users:", error)
    throw error
  }
}

export const getCurrentUser = async (): Promise<User | null> => {
  // TODO: Implement actual current user retrieval logic
  try {
    // Placeholder: returns the first user found. Replace with actual auth logic.
    return await prisma.user.findFirst()
  } catch (error) {
    console.error("Failed to get current user:", error)
    throw error
  }
}

export const createUser = async (userData: {
  username: string
  name: string
  passcode?: string
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
}): Promise<User> => {
  try {
    const hashedPasscode =
      userData.passcode && userData.passcodeType !== "none"
        ? await bcrypt.hash(userData.passcode, 10)
        : null

    return await prisma.user.create({
      data: {
        username: userData.username,
        name: userData.name,
        passcode: hashedPasscode,
        passcodeType: userData.passcodeType || "none",
      },
    })
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
): Promise<User> => {
  try {
    return await prisma.user.update({
      where: { id: userId },
      data: {
        ...(userData.username && { username: userData.username }),
        ...(userData.name && { name: userData.name }),
      },
    })
  } catch (error) {
    console.error("Failed to update user:", error)
    throw error
  }
}

export const updateUserPasscode = async (
  userId: string,
  passcode?: string,
  passcodeType?: "none" | "4digit" | "6digit" | "alphanumeric"
): Promise<User> => {
  try {
    const hashedPasscode =
      passcode && passcodeType !== "none"
        ? await bcrypt.hash(passcode, 10)
        : null

    return await prisma.user.update({
      where: { id: userId },
      data: {
        passcode: hashedPasscode,
        passcodeType: passcodeType || "none",
      },
    })
  } catch (error) {
    console.error("Failed to update user passcode:", error)
    throw error
  }
}
