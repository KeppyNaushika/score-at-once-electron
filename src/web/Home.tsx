import { Link } from "react-router-dom"
import "../styles/Home.css"

import Header from "./Header"

export default function Home() {
  let props = {
    title: "ホーム - 一括採点",
  }
  return (
    <>
      <Header {...props} />
      <div className="home-container">
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
        <div className="projects">
          <div className="search-project">
            <input type="text" placeholder="試験を検索..." />
          </div>
          <table className="projects-table">
            <tr>
              <th className="select-btn"></th>
              <th className="exam">試験名</th>
              <th className="border">
                <span></span>
              </th>
              <th className="date">日時</th>
            </tr>
            <tr>
              <td className="select-btn">
                <span className="material-symbols-rounded">
                  radio_button_checked
                </span>
              </td>
              <td className="exam">
                <div className="name">
                  第１回定着度確認テストあああああああああああああああああああああああああああああああああああああああああああああああああああああああああああああ
                </div>
                <div className="desc">
                  <div className="tags">
                    <div className="tag">第１回定着度確認テスト</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                  </div>
                  <div className="examinee">120 / 150</div>
                  <div className="completion">85</div>
                </div>
              </td>
              <td className="border">
                <span></span>
              </td>
              <td className="date">2023/1/1</td>
            </tr>
            <tr>
              <td className="select-btn">
                <span className="material-symbols-rounded">
                  radio_button_checked
                </span>
              </td>
              <td className="exam">
                <div className="name">
                  第２回定着度確認テスト
                </div>
                <div className="desc">
                  <div className="tags">
                    <div className="tag">第１回定着度確認テスト</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                    <div className="tag">数学</div>
                  </div>
                  <div className="examinee">120 / 150</div>
                  <div className="completion">85</div>
                </div>
              </td>
              <td className="border">
                <span></span>
              </td>
              <td className="date">2023/1/1</td>
            </tr>
            <tr>
              <td className="select-btn">
                <span className="material-symbols-rounded">
                  radio_button_checked
                </span>
              </td>
              <td className="exam">
                <div className="name">
                  第２回定着度確認テスト
                </div>
                <div className="desc">
                  <div className="tags">
                  </div>
                  <div className="examinee">120 / 150</div>
                  <div className="completion">85</div>
                </div>
              </td>
              <td className="border">
                <span></span>
              </td>
              <td className="date">2023/1/1</td>
            </tr>
            
          </table>
        </div>
      </div>
    </>
  )
}
