import React, { type ReactNode } from "react"
import Head from "next/head"

// import { Koruri } from "@/fonts/Koruri"
import { type Tab } from "../pages"

interface TabInfo {
  name: Tab
  display: string
}
const tabs: TabInfo[] = [
  {
    name: "file",
    display: "ファイル",
  },
  {
    name: "info",
    display: "情報",
  },
  {
    name: "crop",
    display: "枠指定",
  },
  {
    name: "import",
    display: "答案読込",
  },
  {
    name: "score",
    display: "一括採点",
  },
  {
    name: "export",
    display: "書き出し",
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
                  setActiveTab(tab.name)
                }}
                className="flex flex-col items-center px-4 py-2 text-center cursor-pointer"
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
    </div>
  )
}
export default Layout
