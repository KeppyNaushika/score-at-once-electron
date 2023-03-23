import { Link } from "react-router-dom"

import "../styles/HomeActionBar.css"

export default function HomeActionBar() {
  return (
    <div className="action-bar">
      <Link to="/project_add">
        <div className="action-btn action-btn-add">
          <div className="symbols">
            <span className="material-symbols-rounded">add_circle</span>
          </div>
          <div className="desc">新規</div>
        </div>
      </Link>
      <div className="action-btn action-btn-edit">
        <div className="symbols">
          <span className="material-symbols-rounded">edit_square</span>
        </div>
        <div className="desc">編集</div>
      </div>
      <div className="action-btn action-btn-import">
        <div className="symbols">
          <span className="material-symbols-rounded">upload_file</span>
        </div>
        <div className="desc">答案読込</div>
      </div>
      <div className="action-btn action-btn-score">
        <div className="symbols">
          <span className="material-symbols-rounded">play_shapes</span>
        </div>
        <div className="desc">一括採点</div>
      </div>
      <div className="action-btn action-btn-pdf">
        <div className="symbols">
          <span className="material-symbols-rounded">print</span>
        </div>
        <div className="desc">書き出し</div>
      </div>
      <div className="action-btn action-btn-setting">
        <div className="symbols">
          <span className="material-symbols-rounded">settings</span>
        </div>
        <div className="desc">設定</div>
      </div>
    </div>
  )
}
