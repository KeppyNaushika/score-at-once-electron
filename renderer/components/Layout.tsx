import React, { useContext, useEffect, useState, type ReactNode } from "react"
import Head from "next/head"

import { TABS, type Tab } from "../pages"
import { ProjectContext } from "./Context/ProjectContext"

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

  const { projects, setProjects, selectedProjectId, setSelectedProjectId } =
    useContext(ProjectContext)

  const [tabs, setTabs] = useState<TabInfo[]>(defaultTabs)

  const loadProjects = async (): Promise<void> => {
    try {
      const projects = await window.electronAPI.fetchProjects()
      setProjects(projects ?? [])
      if (
        projects?.find(
          (project) =>
            project.projectId === localStorage.getItem("selectedProjectId"),
        )
      ) {
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

  useEffect(() => {
    console.log(`loadProjects and selectedProjectId: ${selectedProjectId}`)
    if (projects?.find((project) => project.projectId === selectedProjectId)) {
      setTabs((prev) => prev.map((tab) => ({ ...tab, enable: true })))
    } else {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.name === "file"
            ? { ...tab, enable: true }
            : { ...tab, enable: false },
        ),
      )
    }
  }, [selectedProjectId, projects])

  return (
    <div className="flex h-screen select-none flex-col">
      <Head>
        <title>{title}</title>
        <meta charSet="utf-8" />
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <header className="min-w-full">
        <nav className="flex items-center">
          {tabs.map((tab) => {
            return (
              <div
                key={tab.name}
                onClick={() => {
                  tab.enable &&
                    (tab.name === "file" ||
                      projects.find(
                        (project) =>
                          project.projectId ===
                          localStorage.getItem("selectedProjectId"),
                      )) &&
                    setActiveTab(tab.name)
                }}
                className={`flex flex-col items-center px-4 py-2 text-center ${tab.enable ? "cursor-pointer" : "text-gray-300"}`}
              >
                {tab.display}
                {tab.name === activeTab ? (
                  <div className="h-1 w-8 animate-expand-width rounded bg-black"></div>
                ) : (
                  <div className="h-1 w-0 rounded bg-black"></div>
                )}
              </div>
            )
          })}
        </nav>
      </header>
      {children}
    </div>
  )
}
export default Layout
