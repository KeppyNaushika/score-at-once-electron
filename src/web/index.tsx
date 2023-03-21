import React from "react"
import { createRoot } from "react-dom/client"
import Header from "./Header"
import App from "./App"
import "material-symbols"

createRoot(document.getElementById("root") as Element).render(
  <React.StrictMode>
    <Header />
    <App />
  </React.StrictMode>
)
