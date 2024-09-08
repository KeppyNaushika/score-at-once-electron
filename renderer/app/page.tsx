import React from "react"
import ProjectProvider from "./context/ProjectContext"
import RootLayout from "./layout"

const page = () => {
  return (
    <ProjectProvider>
      <RootLayout>
        <div className="">a</div>
      </RootLayout>
    </ProjectProvider>
  )
}

export default page
