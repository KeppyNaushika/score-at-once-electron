import { PrismaClient } from "@prisma/client"
import { getPrismaClient } from "./client"

export async function createQuestion(data: {
  projectId: string
  title: string
  description?: string
  maxScore: number
  orderIndex: number
}) {
  const prisma = getPrismaClient()
  
  return await prisma.question.create({
    data,
    include: {
      questionParts: {
        include: {
          layoutRegion: true,
          partScores: true,
        },
      },
      questionScores: true,
    },
  })
}

export async function updateQuestion(
  id: string,
  data: {
    title?: string
    description?: string
    maxScore?: number
    orderIndex?: number
  }
) {
  const prisma = getPrismaClient()
  
  return await prisma.question.update({
    where: { id },
    data,
    include: {
      questionParts: {
        include: {
          layoutRegion: true,
          partScores: true,
        },
      },
      questionScores: true,
    },
  })
}

export async function deleteQuestion(id: string) {
  const prisma = getPrismaClient()
  
  return await prisma.question.delete({
    where: { id },
  })
}

export async function getQuestionsByProjectId(projectId: string) {
  const prisma = getPrismaClient()
  
  return await prisma.question.findMany({
    where: { projectId },
    include: {
      questionParts: {
        include: {
          layoutRegion: true,
          partScores: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
      questionScores: true,
    },
    orderBy: { orderIndex: 'asc' },
  })
}

export async function getQuestionById(id: string) {
  const prisma = getPrismaClient()
  
  return await prisma.question.findUnique({
    where: { id },
    include: {
      questionParts: {
        include: {
          layoutRegion: true,
          partScores: true,
        },
        orderBy: { orderIndex: 'asc' },
      },
      questionScores: true,
    },
  })
}

export async function updateQuestionOrders(orders: { id: string; orderIndex: number }[]) {
  const prisma = getPrismaClient()
  
  try {
    const updatePromises = orders.map(({ id, orderIndex }) =>
      prisma.question.update({
        where: { id },
        data: { orderIndex },
      })
    )
    
    await Promise.all(updatePromises)
    
    return { success: true }
  } catch (error) {
    console.error("Error updating question orders:", error)
    throw error
  }
}

export async function createQuestionFromLayoutRegions(
  projectId: string,
  title: string,
  layoutRegionIds: string[],
  description?: string
) {
  const prisma = getPrismaClient()
  
  try {
    // 既存のQuestionの最大orderIndexを取得
    const maxOrderResult = await prisma.question.findFirst({
      where: { projectId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    })
    
    const nextOrderIndex = (maxOrderResult?.orderIndex || 0) + 1
    
    // LayoutRegionの情報を取得
    const layoutRegions = await prisma.layoutRegion.findMany({
      where: { id: { in: layoutRegionIds } },
      include: { project: true },
    })
    
    // 各LayoutRegionのポイントを合計してmaxScoreを計算
    const maxScore = layoutRegions.reduce((sum, region) => sum + (region.points || 0), 0)
    
    // Questionを作成
    const question = await prisma.question.create({
      data: {
        projectId,
        title,
        description,
        maxScore,
        orderIndex: nextOrderIndex,
      },
    })
    
    // QuestionPartを作成
    const questionParts = await Promise.all(
      layoutRegions.map(async (region, index) => {
        return await prisma.questionPart.create({
          data: {
            questionId: question.id,
            layoutRegionId: region.id,
            partLabel: region.label,
            partScore: region.points || 0,
            orderIndex: index,
          },
        })
      })
    )
    
    return {
      ...question,
      questionParts,
    }
  } catch (error) {
    console.error("Error creating question from layout regions:", error)
    throw error
  }
}