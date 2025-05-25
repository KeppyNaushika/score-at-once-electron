import { Prisma, Project } from "@prisma/client"
import prisma from "./client"
import { CreateProjectArgs, UpdateProjectArgs } from "../../../types/electron"

// ProjectWithDetails の include は schema.prisma の Project モデルの実際のリレーション名に合わせる
type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    // createdBy: true // Projectモデルに 'user' リレーション (createdById経由) がある前提
    user: true // schema.prisma の Project.user を参照
    // scorers: true   // Projectモデルに 'scorers' リレーションがある前提 (現状のschemaにはなさそう)
    // templates: true // Projectモデルに 'templates' リレーションがある前提 (現状のschemaにはなさそう)
    // masterImages: true // Projectモデルに 'masterImages' リレーションがある前提 (現状のschemaにはなさそう)
    tags: true // Projectモデルに 'tags' リレーションがある前提
  }
}>

export const fetchProjectsWithExamLogic = async (): Promise<
  ProjectWithDetails[]
> => {
  try {
    return await prisma.project.findMany({
      include: {
        user: true, // schema.prisma の Project.user を参照
        tags: true,
        // masterImages: true, // Projectモデルにリレーションがあれば追加
        // templates: true,    // Projectモデルにリレーションがあれば追加
        // scorers: true,      // Projectモデルにリレーションがあれば追加
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (error) {
    console.error("Failed to fetch projects (formerly exams):", error)
    throw error
  }
}

export const fetchProjectByIdWithExamLogic = async (
  projectIdValue: string, // 変数名を変更して区別
): Promise<ProjectWithDetails | null> => {
  try {
    const project = await prisma.project.findUnique({
      where: { projectId: projectIdValue }, // Projectモデルの主キー 'projectId' を使用
      include: {
        user: true,
        tags: true,
        // masterImages: { // Projectモデルにリレーションがあれば追加
        //   orderBy: {
        //     pageNumber: "asc",
        //   },
        // },
        // templates: true,
        // scorers: true,
      },
    })
    return project
  } catch (error) {
    console.error(
      `Failed to fetch project (formerly exam) by ID ${projectIdValue}:`,
      error,
    )
    throw error
  }
}

export const createProjectWithExamLogic = async (
  projectData: CreateProjectArgs,
): Promise<ProjectWithDetails> => {
  // CreateProjectArgs に userId が含まれているか、または createdById のようなものが別途あるか確認
  // schema.prisma の Project モデルでは userId が optional なので、それに応じて処理
  const { tagIdsOrTexts, userId, ...restData } = projectData
  try {
    return await prisma.project.create({
      data: {
        ...restData,
        ...(userId ? { user: { connect: { id: userId } } } : {}), // Userモデルの主キーが 'id' である前提
        ...(tagIdsOrTexts && tagIdsOrTexts.length > 0
          ? {
              tags: {
                connectOrCreate: tagIdsOrTexts.map(
                  (tag: string | { id?: string; text: string }) => ({
                    where: { text: typeof tag === "string" ? tag : tag.text },
                    create: { text: typeof tag === "string" ? tag : tag.text },
                  }),
                ),
              },
            }
          : {}),
        // scorers, templates, masterImages の作成ロジックは Project モデルの定義による
      },
      include: {
        user: true,
        tags: true,
        // masterImages: true,
        // templates: true,
        // scorers: true,
      },
    })
  } catch (error) {
    console.error("Failed to create project (formerly exam):", error)
    throw error
  }
}

export const updateProjectWithExamLogic = async (
  projectData: UpdateProjectArgs,
): Promise<ProjectWithDetails> => {
  const { projectId, tagIdsOrTexts, userId, ...restData } = projectData // id を projectId に変更
  const updatePayload: Prisma.ProjectUpdateInput = { ...restData }

  if (userId) {
    // userId が渡された場合のみ user リレーションを更新
    updatePayload.user = { connect: { id: userId } }
  } else if (userId === null) {
    // 明示的にnullが渡された場合はリレーションを切断
    updatePayload.user = { disconnect: true }
  }

  if (tagIdsOrTexts) {
    updatePayload.tags = {
      set: [], // 既存のタグを一旦クリアする場合
      connectOrCreate: tagIdsOrTexts.map(
        (tag: string | { id?: string; text: string }) => ({
          where: { text: typeof tag === "string" ? tag : tag.text },
          create: { text: typeof tag === "string" ? tag : tag.text },
        }),
      ),
    }
  }
  // scorers の更新ロジックは Project モデルの定義による

  try {
    return await prisma.project.update({
      where: { projectId: projectId }, // Projectモデルの主キー 'projectId' を使用
      data: updatePayload,
      include: {
        user: true,
        tags: true,
        // masterImages: true,
        // templates: true,
        // scorers: true,
      },
    })
  } catch (error) {
    console.error(
      `Failed to update project (formerly exam) ${projectId}:`,
      error,
    )
    throw error
  }
}

export const deleteProjectWithExamLogic = async (
  projectIdValue: string, // 変数名を変更
): Promise<Project | void> => {
  try {
    // MasterImage と ExamTemplate の Project への関連付けを確認
    // 現状の schema.prisma では MasterImage と ExamTemplate は Exam に関連しており、Project には直接関連していない
    // もし Project にも関連付けるように schema を変更した場合は、以下のコメントアウトを解除・修正
    // await prisma.masterImage.deleteMany({ where: { projectId: projectIdValue } })
    // await prisma.examTemplate.deleteMany({ where: { projectId: projectIdValue } })
    return await prisma.project.delete({ where: { projectId: projectIdValue } }) // Projectモデルの主キー 'projectId' を使用
  } catch (error) {
    console.error(
      `Failed to delete project (formerly exam) ${projectIdValue}:`,
      error,
    )
    throw error
  }
}
