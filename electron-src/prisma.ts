import { type Exam } from "../renderer/pages/Tabs/File/index.type"
import { PrismaClient } from "@prisma/client"
import { NewProject } from "./index.type"

export const fetchProjects = async (): Promise<Exam[] | null> => {
  const prisma = new PrismaClient()

  try {
    const projects = await prisma.project.findMany()
    const exams: Exam[] = projects.map((project) => {
      return {
        selected: project.selected,
        name: project.examName,
        date: project.examDate.toLocaleDateString("ja"),
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

export const createProject = async (props: NewProject) => {
  const { examName, examDate } = props
  const prisma = new PrismaClient()

  try {
    const projects = await prisma.project.findMany()
    projects.map(async (project) => {
      await prisma.project.update({
        where: { id: project.id },
        data: { selected: false },
      })
    })
    await prisma.project.create({
      data: {
        examName: examName,
        examDate: examDate ?? "",
        selected: true,
      },
    })
  } catch (error) {
    console.error("プロジェクト作成中にエラーが発生しました:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}
