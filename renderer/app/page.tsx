import ProjectProvider from "./context/ProjectContext"
import RootLayout from "./layout"
import Tabs from "./Tabs"

const Page = () => {
  return (
    <ProjectProvider>
      <RootLayout>
        <Tabs />
      </RootLayout>
    </ProjectProvider>
  )
}

export default Page
