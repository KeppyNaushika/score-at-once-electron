import "./App.css";
import { useState } from "react"
export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <h1>{count}</h1>
      <button onClick={() => setCount((count) => count + 1)}>Count UP</button>
      <button onClick={() => setCount((count) => count - 1)}>Count DOWN</button>
    </div>
  );
};
