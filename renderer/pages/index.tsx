import React, { useState } from "react"
import Layout from "../components/Layout"
import { type IpcRenderer } from "electron"
import File from "./Tabs/File"
import Info from "./Tabs/Info"
import Crop from "./Tabs/Crop"
import Import from "./Tabs/Import"
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
