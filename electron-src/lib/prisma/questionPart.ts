import { getPrismaClient } from "./client"

export async function createQuestionPart(data: {
  questionId: string
  layoutRegionId: string
  partLabel: string
  partScore: number
  orderIndex: number
}) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.create({
    data,
    include: {
      question: true,
      layoutRegion: true,
      partScores: true,
    },
  })
}

export async function createManyQuestionParts(
  parts: {
    questionId: string
    layoutRegionId: string
    partLabel: string
    partScore: number
    orderIndex: number
  }[],
) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.createMany({
    data: parts,
  })
}

export async function updateQuestionPart(
  id: string,
  data: {
    partLabel?: string
    partScore?: number
    orderIndex?: number
  },
) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.update({
    where: { id },
    data,
    include: {
      question: true,
      layoutRegion: true,
      partScores: true,
    },
  })
}

export async function deleteQuestionPart(id: string) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.delete({
    where: { id },
  })
}

export async function getQuestionPartsByQuestionId(questionId: string) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.findMany({
    where: { questionId },
    include: {
      question: true,
      layoutRegion: true,
      partScores: true,
    },
    orderBy: { orderIndex: "asc" },
  })
}

export async function getQuestionPartById(id: string) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.findUnique({
    where: { id },
    include: {
      question: true,
      layoutRegion: true,
      partScores: true,
    },
  })
}

export async function updateQuestionPartOrders(
  orders: { id: string; orderIndex: number }[],
) {
  const prisma = getPrismaClient()

  try {
    const updatePromises = orders.map(({ id, orderIndex }) =>
      prisma.questionPart.update({
        where: { id },
        data: { orderIndex },
      }),
    )

    await Promise.all(updatePromises)

    return { success: true }
  } catch (error) {
    console.error("Error updating question part orders:", error)
    throw error
  }
}

export async function getQuestionPartsByLayoutRegionId(layoutRegionId: string) {
  const prisma = getPrismaClient()

  return await prisma.questionPart.findMany({
    where: { layoutRegionId },
    include: {
      question: true,
      layoutRegion: true,
      partScores: true,
    },
    orderBy: { orderIndex: "asc" },
  })
}
