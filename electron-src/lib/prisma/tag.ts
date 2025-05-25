import { Prisma } from "@prisma/client"
import prisma from "./client"

export const createTag = async (
  tagText: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    const existingTag = await prisma.tag.findUnique({
      where: { text: tagText },
    })
    if (existingTag) {
      return existingTag
    }
    return await prisma.tag.create({
      data: { text: tagText },
    })
  } catch (error) {
    console.error(`Failed to create tag "${tagText}":`, error)
    throw error
  }
}

export const updateTag = async (
  tagId: string,
  newText: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    const existingTagWithNewText = await prisma.tag.findUnique({
      where: { text: newText },
    })
    if (existingTagWithNewText && existingTagWithNewText.id !== tagId) {
      throw new Error(
        `Tag with text "${newText}" already exists. Cannot update.`,
      )
    }

    return await prisma.tag.update({
      where: { id: tagId },
      data: { text: newText },
    })
  } catch (error) {
    console.error(`Failed to update tag ID "${tagId}":`, error)
    throw error
  }
}

export const deleteTag = async (
  tagId: string,
): Promise<Prisma.TagGetPayload<{}>> => {
  try {
    // Prisma will handle disconnecting this tag from any projects it was related to
    // due to the implicit many-to-many relation table (_ProjectTags).
    return await prisma.tag.delete({
      where: { id: tagId },
    })
  } catch (error) {
    console.error(`Failed to delete tag ID "${tagId}":`, error)
    throw error
  }
}
