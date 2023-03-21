import React from "react"
import "../styles/reset.css"
import "../styles/Projects.css"

export default function Projects() {
  return (
    <header className="projects">
      <table>
        <tr>
          <th className="selectedBtn">選択</th>
          <th className="name">試験名</th>
          <th className="date">年齢</th>
          <th className="completionRate">完了率</th>
          <th className="date">年齢</th>
        </tr>

        <tr>
          <span className="material-symbols-outlined">
            radio_button_checked
          </span>
          <td>さとう</td> <td>19</td> <td>A型</td>
        </tr>
      </table>
    </header>
  )
}
