import { HashRouter, Routes, Route } from "react-router-dom"

import "../styles/reset.css"

import Home from "./Home"
import ProjectAdd from "./ProjectAdd"

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path={`/`} element={<Home />} />
        <Route path={`/project_add/`} element={<ProjectAdd />} />
        {/* <Route path={`/login/`} element={<Login />} /> */}
      </Routes>
    </HashRouter>
  )
}
