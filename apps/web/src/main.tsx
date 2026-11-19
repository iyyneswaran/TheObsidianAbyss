import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Dungeon } from "./pages/Dungeon";
import { Landing } from "./pages/Landing";
import { Playground } from "./pages/Playground";
import "./styles/main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/dungeon" element={<Dungeon />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
