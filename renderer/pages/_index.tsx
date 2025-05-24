import { useState } from "react"

import { type IpcRenderer } from "electron"

import ProjectProvider from "../components/Context/ProjectContext"
import Layout from "../components/Layout"
import Crop from "./Tabs/Crop"
import Export from "./Tabs/Export"
import File from "./Tabs/File"
import Import from "./Tabs/Import"
import Info from "./Tabs/Info"
import ScoreTab from "./Tabs/Score"

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      ipcRenderer: IpcRenderer
    }
  }
}

export const TABS = [
  "file",
  "info",
  "crop",
  "import",
  "score",
  "export",
] as const
export type Tab = (typeof TABS)[number]

const IndexPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0])
  const pages: Record<Tab, JSX.Element> = {
    file: <File />,
    info: <Info />,
    crop: <Crop />,
    import: <Import />,
    score: <ScoreTab />,
    export: <Export />,
  }
  const ActiveTabs = pages[activeTab]

  return (
    <ProjectProvider>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {ActiveTabs}
      </Layout>
    </ProjectProvider>
  )
}

export default IndexPage
