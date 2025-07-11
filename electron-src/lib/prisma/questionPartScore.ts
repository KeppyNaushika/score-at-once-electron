import { PrismaClient } from "@prisma/client"
import { Decimal } from "@prisma/client/runtime/library"
import { getPrismaClient } from "./client"

export async function createQuestionPartScore(data: {
  questionPartId: string
  answerSheetId: string
  score?: number | null
  comment?: string
  scoredByUserId: string
  status?: string
}) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.create({
    data: {
      ...data,
      score: data.score ? new Decimal(data.score) : null,
      status: data.status || "proposed",
    },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
  })
}

export async function createManyQuestionPartScores(scores: {
  questionPartId: string
  answerSheetId: string
  score?: number | null
  comment?: string
  scoredByUserId: string
  status?: string
}[]) {
  const prisma = getPrismaClient()
  
  const data = scores.map(score => ({
    ...score,
    score: score.score ? new Decimal(score.score) : null,
    status: score.status || "proposed",
  }))
  
  return await prisma.questionPartScore.createMany({
    data,
  })
}

export async function updateQuestionPartScore(
  id: string,
  data: {
    score?: number | null
    comment?: string
    status?: string
  }
) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.update({
    where: { id },
    data: {
      ...data,
      score: data.score !== undefined ? (data.score ? new Decimal(data.score) : null) : undefined,
    },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
  })
}

export async function deleteQuestionPartScore(id: string) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.delete({
    where: { id },
  })
}

export async function getQuestionPartScoresByQuestionPartId(questionPartId: string) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.findMany({
    where: { questionPartId },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getQuestionPartScoreById(id: string) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.findUnique({
    where: { id },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
  })
}

export async function getQuestionPartScoresByAnswerSheetId(answerSheetId: string) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.findMany({
    where: { answerSheetId },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
    orderBy: [
      { questionPart: { question: { orderIndex: 'asc' } } },
      { questionPart: { orderIndex: 'asc' } },
    ],
  })
}

export async function getQuestionPartScoresByProjectId(projectId: string) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.findMany({
    where: {
      questionPart: {
        question: {
          projectId,
        },
      },
    },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
    orderBy: [
      { questionPart: { question: { orderIndex: 'asc' } } },
      { questionPart: { orderIndex: 'asc' } },
      { answerSheet: { pageNumber: 'asc' } },
    ],
  })
}

export async function upsertQuestionPartScore(data: {
  questionPartId: string
  answerSheetId: string
  scoredByUserId: string
  score?: number | null
  comment?: string
  status?: string
}) {
  const prisma = getPrismaClient()
  
  return await prisma.questionPartScore.upsert({
    where: {
      questionPartId_answerSheetId_scoredByUserId: {
        questionPartId: data.questionPartId,
        answerSheetId: data.answerSheetId,
        scoredByUserId: data.scoredByUserId,
      },
    },
    update: {
      score: data.score ? new Decimal(data.score) : null,
      comment: data.comment,
      status: data.status || "proposed",
    },
    create: {
      questionPartId: data.questionPartId,
      answerSheetId: data.answerSheetId,
      scoredByUserId: data.scoredByUserId,
      score: data.score ? new Decimal(data.score) : null,
      comment: data.comment,
      status: data.status || "proposed",
    },
    include: {
      questionPart: {
        include: {
          question: true,
          layoutRegion: true,
        },
      },
      answerSheet: true,
      scoredByUser: true,
    },
  })
}