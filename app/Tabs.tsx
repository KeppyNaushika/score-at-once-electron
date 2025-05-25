"use client"
import React from "react"
import { usePathname } from "next/navigation"
import { TABS, type TabName } from "../renderer/constants/tabs" // Import from constants

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
