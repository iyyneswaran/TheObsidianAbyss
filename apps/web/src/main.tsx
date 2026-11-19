import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CharacterSelection } from "./pages/CharacterSelection";
import { Dungeon, PlayDungeon } from "./pages/Dungeon";
import { Landing } from "./pages/Landing";
import { Playground } from "./pages/Playground";
import { Party } from "./pages/Party";
import { OnlineDungeon } from "./pages/OnlineDungeon";
import { PartyRouteLifecycle } from "./multiplayer/useParty";
import { AccountForm, Profile } from "./progression/Account";
import { ProgressionNav } from "./progression/common";
import { Store, Vault } from "./progression/Equipment";
import { Quests } from "./progression/Quests";
import "./styles/main.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PartyRouteLifecycle />
      <ProgressionNav />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/playground" element={<Playground />} />
        <Route path="/dungeon" element={<Dungeon />} />
        <Route path="/dungeon/play" element={<PlayDungeon />} />
        <Route path="/characters" element={<CharacterSelection />} />
        <Route path="/party" element={<Party />} />
        <Route path="/dungeon/online" element={<OnlineDungeon />} />
        <Route path="/register" element={<AccountForm mode="register" />} />
        <Route path="/login" element={<AccountForm mode="login" />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/store" element={<Store />} />
        <Route path="/vault" element={<Vault />} />
        <Route path="/quests" element={<Quests />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
