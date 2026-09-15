import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Host from "./pages/Host.jsx";
import Join from "./pages/Join.jsx";
import PlayerGame from "./pages/PlayerGame.jsx";
import Solo from "./pages/Solo.jsx";
import Cursor from "./components/Cursor.jsx";
import NavBar from "./components/NavBar.jsx";

export default function App() {
  return (
    <>
      <Cursor />
      <NavBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<Host />} />
        <Route path="/join" element={<Join />} />
        <Route path="/play" element={<PlayerGame />} />
        <Route path="/solo" element={<Solo />} />
      </Routes>
    </>
  );
}