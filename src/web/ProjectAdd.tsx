import { Link } from "react-router-dom"

import "../styles/ProjectAdd.css"

import Header from "./Header"

const tag_data = [
  ["試験名", "第１回定着度確認テスト", "第２回テスト", "第３回テスト"],
  ["教科", "国語", "数学", "理科", "社会", "英語"],
  ["年度", "2022", "2023", "2024"],
  ["教科", "国語", "数学", "理科", "社会", "英語"],
  ["教科", "国語", "数学", "理科", "社会", "英語"],
  // ["教科", "国語", "数学", "理科", "社会", "英語", ""],
]

let html_tags = ""

export default function ProjectAdd() {
  let props = {
    title: "試験の新規追加 - 一括採点",
  }
  return (
    <>
      <Header {...props} />
      <div className="project-add-container">
        <div className="project-input-container project-input-name-container">
          <div className="project-input project-input-name">
            <input type="text" placeholder="新規試験名" />
          </div>
        </div>
        <div className="project-input-container project-input-date-container">
          <div className="project-input project-input-date">
            <input type="date" placeholder="試験日時" />
          </div>
        </div>
        <div className="project-input-container project-input-tag-container">
          <div className="project-input project-input-tag">
            <input type="text" placeholder="タグ" />
          </div>
        </div>
        <div className="tags-container">
          {html_tags}
          {tag_data.map((tags) => (
            <div className="tags">
              {tags.map((tag) => (
                <div className="tag">
                  <input type="text" value={tag} placeholder="タグ" disabled />
                  <div className="edit">
                    <span className="material-symbols-outlined">edit</span>
                  </div>
                  <div className="delete">
                    <span className="material-symbols-outlined">delete</span>
                  </div>
                </div>
              ))}
              <div className="tag tag-new">
                <input type="text" placeholder="新しいタグを追加..." />
              </div>
            </div>
          ))}
        </div>
        <div className="save-cancel-container">
          <Link to="/">
            <div className="save-cancel-btn cancel-btn">キャンセル</div>
          </Link>
          <div className="save-cancel-btn save-btn">保存</div>
        </div>
      </div>
    </>
  )
}
