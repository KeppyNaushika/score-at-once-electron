import React from "react"
import "../styles/reset.css"
import "../styles/Projects.css"

export default function Projects() {
  return (
    <div className="container">
      <div className="action-bar">
        <div className="action-btn action-btn-add">
          <div className="symbols">
            <span className="material-symbols-outlined">playlist_add</span>
          </div>
          <div className="desc">新規</div>
        </div>
        <div className="action-btn action-btn-crop">
          <div className="symbols">
            <span className="material-symbols-outlined">demography</span>
          </div>
          <div className="desc">受験者名簿</div>
        </div>
        <div className="action-btn action-btn-crop">
          <div className="symbols">
            <span className="material-symbols-outlined">crop</span>
          </div>
          <div className="desc">採点枠と配点</div>
        </div>
        <div className="action-btn action-btn-crop">
          <div className="symbols">
            <span className="material-symbols-outlined">play_shapes</span>
          </div>
          <div className="desc">一括採点</div>
        </div>
        <div className="action-btn action-btn-pdf">
          <div className="symbols">
            <span className="material-symbols-outlined">picture_as_pdf</span>
          </div>
          <div className="desc">採点答案印刷</div>
        </div>
        <div className="action-btn action-btn-pdf">
          <div className="symbols">
            <span className="material-symbols-outlined">picture_as_pdf</span>
          </div>
          <div className="desc">CSV 出力</div>
        </div>
        <div className="action-btn action-btn-edit">
          <div className="symbols">
            <span className="material-symbols-outlined">edit_note</span>
          </div>
          <div className="desc">編集</div>
        </div>
        <div className="action-btn action-btn-delete">
          <div className="symbols">
            <span className="material-symbols-outlined">delete</span>
          </div>
          <div className="desc">削除</div>
        </div>
      </div>
      <div className="projects">
        <table className="projects-table">
          <tr>
            <th className="selectedBtn">選択</th>
            <th className="name">試験名</th>
            <th className="date">日時</th>
            <th className="completion">完了率</th>
            <th className="date">採点者</th>
          </tr>

          <tr>
            <td className="selectedBtn">
              <span className="material-symbols-outlined">
                radio_button_checked
              </span>
            </td>
            <td className="name">第１回定着度確認テスト</td>
            <td className="date">
              <div>2023/1/1</div>
              <div>2023/1/1</div>
            </td>
            <td className="completion">83 %</td>
            <td>○</td>
          </tr>
        </table>
      </div>
    </div>
  )
}
