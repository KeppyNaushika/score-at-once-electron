import { HashRouter, Routes, Route } from "react-router-dom"

import "../styles/reset.css"

import Home from "./Home"
import ProjectAdd from "./ProjectAdd"
import ProjectEdit from "./ProjectEdit"

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path={`/`} element={<Home />} />
        <Route path={`/project_add/`} element={<ProjectAdd />} />
        <Route path={`/project_edit/`} element={<ProjectEdit />} />
        {/* <Route path={`/login/`} element={<Login />} /> */}
      </Routes>
    </HashRouter>
  )
}
