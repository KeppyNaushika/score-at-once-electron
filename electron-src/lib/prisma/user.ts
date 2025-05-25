import { User } from "@prisma/client"
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
