import { Routes, Route } from "react-router-dom";
import { GraphLibrary } from "./components/library/GraphLibrary";
import { Workspace } from "./components/layout/Workspace";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<GraphLibrary />} />
      <Route path="/graph/:graphId" element={<Workspace />} />
    </Routes>
  );
}
