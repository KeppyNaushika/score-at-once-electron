import type { CreateProjectProps } from "@/electron-src/prisma"
import { Prisma, type Tag } from "@prisma/client"

export interface MyAPI {
  fetchProjects: () => Promise<
    Prisma.ProjectGetPayload<{ include: { tags: true } }>[]
  >
  fetchProjectById: (
    projectId: string,
  ) => Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }> | null>
  createProject: (
    props: CreateProjectProps,
  ) => Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>>
  updateProject: (
    projectPayload: Prisma.ProjectGetPayload<{ include: { tags: true } }>,
  ) => Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>>
  deleteProject: (
    projectId: string,
  ) => Promise<Prisma.ProjectGetPayload<{ include: { tags: true } }>>
  createTag: (tagText: string) => Promise<Prisma.TagGetPayload<{}>>
  updateTag: (
    tagId: string,
    newText: string,
  ) => Promise<Prisma.TagGetPayload<{}>>
  deleteTag: (tagId: string) => Promise<Prisma.TagGetPayload<{}>>
  sendScorePanel: (data: any) => Promise<void>
  sendScorePanel: (arg: string) => unknown
  removeScorePanelListener: (
    listener: (_event: Electron.IpcRendererEvent, value: any) => void,
  ) => unknown
  setShortcut: (page: string) => void
  scorePanel: (listener: (_event: any, value: any) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: MyAPI
  }
}
