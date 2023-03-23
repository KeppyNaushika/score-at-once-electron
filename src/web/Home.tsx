import "../styles/Home.css"

import Header from "./Header"
import HomeActionBar from "./HomeActionBar"
import Projects from "./Projects"

export default function Home() {
  let props = {
    title: 'ホーム - 一括採点'
  }
  return (
    <>
      <Header {...props}/>
      <div className="home-container">
        <HomeActionBar />
        <Projects />
      </div>
    </>
  )
}
