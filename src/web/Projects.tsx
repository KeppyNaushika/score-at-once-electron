import "../styles/Projects.css"

export default function Projects() {
  return (
    <div className="projects">
      <div className="search-project">
        <input type="text" placeholder="試験を検索..." />
      </div>
      <table className="projects-table">
        <tr>
          <th className="select-btn"></th>
          <th className="exam">試験名</th>
          <th className="border"><span></span></th>
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
          <td className="border"><span></span></td>
          <td className="date">2023/1/1</td>
        </tr>
      </table>
    </div>
  )
}
