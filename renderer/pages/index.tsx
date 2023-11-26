import React, { useState } from "react"
import Layout from "../components/Layout"
import { type IpcRenderer } from "electron"
import File from "../components/Tabs/File"
import Info from "../components/Tabs/Info"
import Crop from "../components/Tabs/Crop"
import Import from "../components/Tabs/Import"
import ScoreTab from "../components/Tabs/Score"

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

const IndexPage = (): JSX.Element => {
  const [activeTab, setActiveTab] = useState<Tab>(TABS[0])
  const pages: Record<Tab, JSX.Element> = {
    file: <File />,
    info: <Info />,
    crop: <Crop />,
    import: <Import />,
    score: <ScoreTab />,
    export: <></>,
  }
  const ActiveTabs = pages[activeTab]

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {ActiveTabs}
    </Layout>
  )
}

export default IndexPage
