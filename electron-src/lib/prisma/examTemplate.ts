import { Prisma, ExamTemplate } from "@prisma/client"
import prisma from "./client" // Assuming you have a way to get the current user's ID, e.g., from a session or auth state.
// For this example, let's assume it's passed in or available globally.
// import { getCurrentUserId } from "../auth"; // Placeholder for getting user ID

export const saveExamTemplate = async (
  templateData:
    | (Prisma.ExamTemplateCreateInput & { createdById?: string }) // createdById をオプションで追加
    | (Prisma.ExamTemplateUpdateInput & { id: string; createdById?: never }), // 更新時は createdById を許可しない
): Promise<ExamTemplate> => {
  try {
    if ("id" in templateData && templateData.id) {
      // Update existing template
      const { id, ...updateDataInput } = templateData

      // Ensure createdById is not part of the update payload
      const updatePayload: Prisma.ExamTemplateUpdateInput = {
        ...updateDataInput,
      }
      if ("createdById" in updatePayload) {
        delete (updatePayload as any).createdById
      }

      return await prisma.examTemplate.update({
        where: { id },
        data: updatePayload, // updatePayload を使用
      })
    } else {
      // Create new template
      const { createdById, ...createDataInput } =
        templateData as Prisma.ExamTemplateCreateInput & {
          createdById?: string
        }

      const dataPayload: Prisma.ExamTemplateCreateInput = { ...createDataInput }

      if (createdById && !createDataInput.createdBy) {
        dataPayload.createdBy = { connect: { id: createdById } }
      } else if (!createDataInput.createdBy) {
        // createdBy も createdById もない場合はエラー
        throw new Error(
          "createdBy relation or createdById must be provided for new ExamTemplate",
        )
      }
      // createDataInput.createdBy が既に正しい形式であればそれが使われる

      return await prisma.examTemplate.create({
        data: dataPayload,
      })
    }
  } catch (error) {
    console.error("Failed to save exam template:", error)
    throw error
  }
}

export const fetchExamTemplate = async (
  templateId: string,
): Promise<ExamTemplate | null> => {
  try {
    return await prisma.examTemplate.findUnique({ where: { id: templateId } })
  } catch (error) {
    console.error(`Failed to fetch exam template ${templateId}:`, error)
    throw error
  }
}

export const deleteExamTemplate = async (
  templateId: string,
): Promise<ExamTemplate | void> => {
  try {
    return await prisma.examTemplate.delete({ where: { id: templateId } })
  } catch (error) {
    console.error(`Failed to delete exam template ${templateId}:`, error)
    throw error
  }
}
