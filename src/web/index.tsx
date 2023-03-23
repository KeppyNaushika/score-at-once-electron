import React from "react"
import { createRoot } from "react-dom/client"
import App from "./App"
import "material-symbols"

createRoot(document.getElementById("root") as Element).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
