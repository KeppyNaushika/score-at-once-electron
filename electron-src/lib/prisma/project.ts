import type { Prisma as PrismaTypes } from "@prisma/client"
import prisma from "./client"

// Project一覧を取得 (ユーザーでフィルタリング)
export const getProjects = async (userId: string) => {
  return prisma.project.findMany({
    where: {
      userProjects: {
        some: {
          userId,
        },
      },
    },
    include: {
      userProjects: {
        include: {
          user: true,
        },
      },
      projectPages: {
        include: {
          pageImages: {
            include: {
              student: true,
            },
          },
          cropRegions: {
            include: {
              questionScores: {
                include: {
                  student: true,
                  scoredByUser: true,
                },
              },
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: {
          pageNumber: "asc",
        },
      },
      projectSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: true,
            },
          },
        },
      },
      projectStudents: true,
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
      userProjects: {
        include: {
          user: true,
        },
      },
      projectPages: {
        include: {
          pageImages: {
            include: {
              student: true,
            },
          },
          cropRegions: {
            include: {
              questionScores: {
                include: {
                  student: true,
                  scoredByUser: true,
                },
              },
            },
            orderBy: {
              orderIndex: "asc",
            },
          },
        },
        orderBy: {
          pageNumber: "asc",
        },
      },
      projectSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
      },
      projectStudents: {
        include: {
          student: true,
        },
        orderBy: {
          customOrder: "asc",
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
  data: Omit<PrismaTypes.ProjectCreateInput, "userProjects">,
  userId: string
) => {
  return prisma.project.create({
    data: {
      ...data,
      userProjects: {
        create: {
          userId: userId,
          role: "OWNER",
        },
      },
    },
    include: {
      userProjects: {
        include: {
          user: true,
        },
      },
      projectPages: {
        include: {
          pageImages: true,
          cropRegions: true,
        },
      },
      projectSubtotalGroups: {
        include: {
          subtotalGroup: {
            include: {
              subtotals: true,
            },
          },
        },
      },
    },
  })
}

// Project更新
export const updateProject = async (
  id: string,
  data: PrismaTypes.ProjectUpdateInput
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
