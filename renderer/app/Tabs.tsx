"use client"
import React from "react"
import { usePathname } from "next/navigation"

const TABS = [
  {
    name: "file",
    display: "ファイル",
    enable: true,
  },
  {
    name: "student",
    display: "生徒",
    enable: true,
  },
  {
    name: "crop",
    display: "解答枠指定",
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
] as const

type Tab = (typeof TABS)[number]["name"]

const Tabs = () => {
  const path = usePathname()
  console.log(path)

  return (
    <div className="flex items-center">
      {TABS.map((tab, index) => {
        return (
          <div
            key={index}
            className={`${tab.enable ? "cursor-pointer" : "text-gray-300"} flex flex-col items-center px-4 py-2 text-center`}
          >
            {tab.display}
            {path?.includes(tab.name) ? (
              <div className="h-1 w-8 animate-expand-width rounded bg-black"></div>
            ) : (
              <div className="h-1 w-0 rounded bg-black"></div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default Tabs
