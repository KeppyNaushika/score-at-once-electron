import { Project } from "@prisma/client"
import React, { createContext, Dispatch, SetStateAction, useState } from "react"

type Props = {
  children: React.ReactNode
}

type ProjectContextType = {
  projects: Project[]
  setProjects: Dispatch<SetStateAction<Project[]>>
}

export const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  setProjects: () => {},
})

const ProjectProvider: React.FC<Props> = ({ children }) => {
  const [projects, setProjects] = useState<Project[]>([])
  return (
    <ProjectContext.Provider value={{ projects, setProjects }}>
      {children}
    </ProjectContext.Provider>
  )
}

export default ProjectProvider
