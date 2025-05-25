import prisma from "./client"
import type { Prisma as PrismaTypes } from "@prisma/client"

// Project一覧を取得 (関連情報も含む)
export const getProjects = async () => {
  return prisma.project.findMany({
    include: {
      user: true, // MODIFIED: was createdBy
      projectSessions: true, // MODIFIED: was sessions
      masterImages: true,
      questionGroups: {
        include: {
          items: true,
        },
      },
      layoutRegions: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

// getProjects の戻り値の型
export type ProjectPayload = PrismaTypes.PromiseReturnType<
  typeof getProjects
>[number]

// IDで単一のProjectを取得 (詳細情報も含む)
export const getProjectById = async (id: string) => {
  return prisma.project.findUnique({
    where: { id },
    include: {
      user: true, // MODIFIED: was createdBy
      projectSessions: {
        // MODIFIED: was sessions
        include: {
          user: true,
        },
      },
      masterImages: {
        orderBy: {
          pageNumber: "asc",
        },
      },
      layoutRegions: {
        orderBy: {
          id: "asc",
        },
      },
      questionGroups: {
        include: {
          items: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      answerSheets: {
        include: {
          student: true,
          questionScores: true, // MODIFIED: was scores
        },
      },
    },
  })
}

// getProjectById の戻り値の型
export type ProjectWithDetailsPayload = PrismaTypes.PromiseReturnType<
  typeof getProjectById
>

// Project作成
export const createProject = async (
  data: Omit<PrismaTypes.ProjectCreateInput, "user">, // MODIFIED: was createdBy
  userId: string,
) => {
  return prisma.project.create({
    data: {
      ...data, // name, projectDate, description など
      user: {
        // MODIFIED: was createdBy
        connect: { id: userId },
      },
    },
  })
}

// Project更新
export const updateProject = async (
  id: string,
  data: PrismaTypes.ProjectUpdateInput,
) => {
  return prisma.project.update({
    where: { id },
    data,
  })
}

// Project削除
export const deleteProject = async (id: string) => {
  return prisma.project.delete({
    where: { id },
  })
}

// --- ProjectSession (コラボレーター管理) ---
// ProjectSessionの作成 (プロジェクトにメンバーを追加)
export const addMemberToProject = async (projectId: string, userId: string) => {
  return prisma.projectSession.create({
    data: {
      project: {
        connect: { id: projectId },
      },
      user: {
        connect: { id: userId },
      },
    },
  })
}

// ProjectSessionの削除 (プロジェクトからメンバーを削除)
export const removeMemberFromProject = async (projectSessionId: string) => {
  return prisma.projectSession.delete({
    where: { id: projectSessionId },
  })
}

// 特定のプロジェクトの全メンバー(ProjectSession)を取得
export const getProjectMembers = async (projectId: string) => {
  return prisma.projectSession.findMany({
    where: { projectId },
    include: {
      user: true,
    },
  })
}
