import React, { useContext, useState, type ReactNode } from "react"
import Head from "next/head"

// import { Koruri } from "@/fonts/Koruri"
import { type Tab } from "../pages"
import { Project } from "@prisma/client"
import ProjectProvider, { ProjectContext } from "./Context/ProjectContext"

interface TabInfo {
  name: Tab
  display: string
  enable: boolean
}
const defaultTabs: TabInfo[] = [
  {
    name: "file",
    display: "ファイル",
    enable: true,
  },
  {
    name: "info",
    display: "情報",
    enable: true,
  },
  {
    name: "crop",
    display: "枠指定",
    enable: true,
  },
  {
    name: "import",
    display: "答案読込",
    enable: true,
  },
  {
    name: "score",
    display: "一括採点",
    enable: true,
  },
  {
    name: "export",
    display: "書き出し",
    enable: true,
  },
]

const Layout = ({
  children,
  activeTab,
  setActiveTab,
}: {
  children: ReactNode
  activeTab: Tab
  setActiveTab: React.Dispatch<React.SetStateAction<Tab>>
}): JSX.Element => {
  const title = "This is the default title"

  const projectContext = useContext(ProjectContext)
  const [projects, setProjects] = [
    projectContext.projects,
    projectContext.setProjects,
  ]
  const [tabs, setTabs] = useState<TabInfo[]>(defaultTabs)

  const loadProjects = async (): Promise<void> => {
    try {
      const projects = await window.electronAPI.fetchProjects()
      setProjects(projects ?? [])
      if (projects?.filter((project) => project.selected).length === 1) {
        setTabs((prev) => prev.map((tab) => ({ ...tab, enable: true })))
      } else {
        setTabs((prev) =>
          prev.map((tab) => ({
            ...tab,
            enable: tab.name === "file" ? true : false,
          })),
        )
      }
    } catch (error) {
      console.error("エラーが発生しました:", error)
    }
  }

  return (
    <div className="flex h-screen select-none flex-col">
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <ProjectProvider>
        <header className="min-w-full">
          <nav className="flex items-center">
            {tabs.map((tab) => {
              return (
                <div
                  key={tab.name}
                  onClick={() => {
                    tab.enable && setActiveTab(tab.name)
                  }}
                  className={`flex flex-col items-center px-4 py-2 text-center ${tab.enable ? "cursor-pointer" : "text-gray-300"}`}
                >
                  {tab.display}
                  {tab.name === activeTab ? (
                    <div className=" h-1 w-8 animate-expand-width rounded bg-black"></div>
                  ) : (
                    <div className=" h-1 w-0 rounded bg-black"></div>
                  )}
                </div>
              )
            })}
          </nav>
        </header>
        {children}
      </ProjectProvider>
    </div>
  )
}
export default Layout
