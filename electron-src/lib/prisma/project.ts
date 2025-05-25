import { Prisma, Project, ExamTemplate } from "@prisma/client"
import prisma from "./client"
import type {
  CreateProjectArgs,
  UpdateProjectArgs,
} from "../../../types/electron"

export type ProjectWithDetails = Prisma.ProjectGetPayload<{
  include: {
    user: true
    tags: true
    masterImages: true // Assumes Project model has 'masterImages' relation in schema.prisma
    templates: true // Assumes Project model has 'templates' relation (for ExamTemplate) in schema.prisma
  }
}>

export type CreateProjectProps = CreateProjectArgs

export const fetchProjects = async (): Promise<ProjectWithDetails[]> => {
  try {
    return await prisma.project.findMany({
      include: {
        user: true,
        tags: true,
        masterImages: true, // Assumes Project model has 'masterImages' relation
        templates: true, // Assumes Project model has 'templates' relation
      },
      orderBy: { createdAt: "desc" },
    })
  } catch (error) {
    console.error("Failed to fetch projects:", error)
    throw error
  }
}

export const fetchProjectById = async (
  projectId: string,
): Promise<ProjectWithDetails | null> => {
  try {
    return await prisma.project.findUnique({
      where: { projectId: projectId },
      include: {
        user: true,
        tags: true,
        masterImages: {
          // Assumes Project model has 'masterImages' relation
          orderBy: {
            pageNumber: "asc",
          },
        },
        templates: true, // Assumes Project model has 'templates' relation
      },
    })
  } catch (error) {
    console.error(`Failed to fetch project by ID ${projectId}:`, error)
    throw error
  }
}

export const createProject = async (
  projectData: CreateProjectProps,
): Promise<ProjectWithDetails> => {
  const { tagIdsOrTexts, userId, examName, description, examDate } = projectData
  try {
    return await prisma.project.create({
      data: {
        examName, // This field name is from Project model in schema.prisma
        description,
        examDate, // This field name is from Project model in schema.prisma
        ...(userId ? { user: { connect: { id: userId } } } : {}),
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
        // If MasterImages or Templates should be created/connected here, add logic
      },
      include: {
        user: true,
        tags: true,
        masterImages: true, // Assumes Project model has 'masterImages' relation
        templates: true, // Assumes Project model has 'templates' relation
      },
    })
  } catch (error) {
    console.error("Failed to create project:", error)
    throw error
  }
}

export const updateProject = async (
  projectData: UpdateProjectArgs & { projectId: string },
): Promise<ProjectWithDetails> => {
  const { projectId, tagIdsOrTexts, userId, examName, description, examDate } =
    projectData // Ensure all fields from UpdateProjectArgs are handled
  const updatePayload: Prisma.ProjectUpdateInput = {
    examName, // This field name is from Project model in schema.prisma
    description,
    examDate, // This field name is from Project model in schema.prisma
  }

  if (userId !== undefined) {
    updatePayload.user = userId
      ? { connect: { id: userId } }
      : { disconnect: true }
  }

  if (tagIdsOrTexts) {
    updatePayload.tags = {
      set: [],
      connectOrCreate: tagIdsOrTexts.map(
        (tag: string | { id?: string; text: string }) => ({
          where: { text: typeof tag === "string" ? tag : tag.text },
          create: { text: typeof tag === "string" ? tag : tag.text },
        }),
      ),
    }
  }

  try {
    return await prisma.project.update({
      where: { projectId: projectId },
      data: updatePayload,
      include: {
        user: true,
        tags: true,
        masterImages: true, // Assumes Project model has 'masterImages' relation
        templates: true, // Assumes Project model has 'templates' relation
      },
    })
  } catch (error) {
    console.error(`Failed to update project ${projectId}:`, error)
    throw error
  }
}

export const deleteProject = async (
  projectId: string,
): Promise<Project | void> => {
  try {
    // スキーマ変更後、これらの where句は正しく解決されるはず
    await prisma.masterImage.deleteMany({ where: { projectId: projectId } })
    await prisma.examTemplate.deleteMany({ where: { projectId: projectId } })
    return await prisma.project.delete({ where: { projectId: projectId } })
  } catch (error) {
    console.error(`Failed to delete project ${projectId}:`, error)
    throw error
  }
}

// --- ExamTemplate related functions (now associated with Project) ---

export type ExamTemplateWithProject = Prisma.ExamTemplateGetPayload<{
  include: { project: true; createdBy: true } // Assumes ExamTemplate has 'project' relation
}>

export const saveProjectTemplate = async (
  templateData:
    | (Omit<Prisma.ExamTemplateCreateInput, "project" | "createdBy"> & {
        // Assumes ExamTemplate relates to Project
        projectId: string
        createdById: string
      })
    | (Prisma.ExamTemplateUpdateInput & {
        id: string
        projectId?: string // Assumes ExamTemplate relates to Project
        createdById?: string
      }),
): Promise<ExamTemplateWithProject> => {
  if ("id" in templateData && templateData.id) {
    // Update
    const { id, projectId, createdById, ...dataToUpdate } = templateData
    const updatePayload: Prisma.ExamTemplateUpdateInput = dataToUpdate
    if (projectId) {
      updatePayload.project = { connect: { projectId } } // Assumes ExamTemplate relates to Project
    }
    if (createdById) {
      updatePayload.createdBy = { connect: { id: createdById } }
    }
    return prisma.examTemplate.update({
      where: { id },
      data: updatePayload,
      include: { project: true, createdBy: true },
    })
  } else {
    // Create
    const { projectId, createdById, ...dataToCreate } = templateData as Omit<
      Prisma.ExamTemplateCreateInput,
      "project" | "createdBy"
    > & { projectId: string; createdById: string } // Assumes ExamTemplate relates to Project
    return prisma.examTemplate.create({
      data: {
        ...dataToCreate,
        project: { connect: { projectId: projectId } }, // Assumes ExamTemplate relates to Project
        createdBy: { connect: { id: createdById } },
      },
      include: { project: true, createdBy: true },
    })
  }
}

export const fetchProjectTemplateById = async (
  templateId: string,
): Promise<ExamTemplateWithProject | null> => {
  return prisma.examTemplate.findUnique({
    where: { id: templateId },
    include: { project: true, createdBy: true }, // Assumes ExamTemplate has 'project' relation
  })
}

export const fetchProjectTemplatesByProjectId = async (
  projectId: string,
): Promise<ExamTemplateWithProject[]> => {
  return prisma.examTemplate.findMany({
    where: { projectId: projectId }, // Assumes ExamTemplate has 'projectId' FK
    include: { project: true, createdBy: true }, // Assumes ExamTemplate has 'project' relation
  })
}

export const deleteProjectTemplate = async (
  templateId: string,
): Promise<ExamTemplate | void> => {
  try {
    return await prisma.examTemplate.delete({ where: { id: templateId } })
  } catch (error) {
    console.error(`Failed to delete project template ${templateId}:`, error)
    throw error
  }
}
