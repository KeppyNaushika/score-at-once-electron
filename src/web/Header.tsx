import React from "react"
import logo from "../svg/logo.svg"
import "../styles/reset.css"
import "../styles/Header.css"

export default function Header() {
  return (
    <header className="App-Header">
      <a href="#" className="app-icon">
        <img src={logo} alt="一括採点" />
      </a>
      <div className="title">
        <h1>第４回定着度確認テスト - 採点</h1>
      </div>
      <div className="help">
        <div className="gg-search"></div>
        <input type="text" placeholder="検索" />
      </div>
    </header>
  )
}