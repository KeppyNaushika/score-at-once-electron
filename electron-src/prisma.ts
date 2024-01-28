import { type Exam } from "../renderer/components/File/index.type"
import { PrismaClient } from "@prisma/client"

export const fetchProjects = async (): Promise<Exam[] | null> => {
  const prisma = new PrismaClient()

  try {
    const projects = await prisma.project.findMany()
    const examDates = await prisma.examDate.findMany()
    const exams: Exam[] = projects.map((project) => {
      return {
        selected: project.selected,
        name: project.examName,
        date: examDates
          .filter((examDate) => examDate.projectId === project.projectId)
          .map((examDate) => examDate.date.toDateString()),
      }
    })
    return exams
  } catch (error) {
    console.error("データの取得中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}
