import React from "react"
import ProjectProvider from "./context/ProjectContext"
import RootLayout from "./layout"
import Tabs from "./Tabs"

const Page = (): JSX.Element => {
  return (
    <ProjectProvider>
      <RootLayout>
        <Tabs />
      </RootLayout>
    </ProjectProvider>
  )
}

export default Page
