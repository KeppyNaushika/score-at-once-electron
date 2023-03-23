import "../styles/reset.css"
import "../styles/Header.css"

import logo from "../svg/logo.svg"

type HeaderProps = {
  title: string
}

export default function Header(props: HeaderProps) {
  return (
    <header className="App-Header">
      <a href="#" className="app-icon">
        <img src={logo} alt="一括採点" />
      </a>
      <div className="title">
        <h1>{props.title}</h1>
      </div>
      <div className="help">
        <div className="gg-search"></div>
        <input type="text" placeholder="検索" />
      </div>
    </header>
  )
}