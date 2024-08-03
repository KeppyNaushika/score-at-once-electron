import { Project } from "@prisma/client"
import React, { createContext, Dispatch, SetStateAction, useState } from "react"

type Props = {
  children: React.ReactNode
}

type ProjectContextType = {
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
  selectedProjectId: string | null
  setSelectedProjectId: Dispatch<SetStateAction<string | null>>
}

export const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  setProjects: () => {},
  selectedProjectId: null,
  setSelectedProjectId: () => {},
})

const ProjectProvider: React.FC<Props> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  )
  return (
    <ProjectContext.Provider
      value={{ projects, setProjects, selectedProjectId, setSelectedProjectId }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export default ProjectProvider
