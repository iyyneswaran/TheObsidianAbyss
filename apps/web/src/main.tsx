import { StrictMode, useRef, useState, useEffect } from "react";
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
import { PlayerPreferences, Settings } from "./settings/Settings";
import "./styles/main.css";
import "./styles/interface.css";

function SettingsNavigation() {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) ref.current?.showModal();
  }, [open]);
  return (
    <>
      <ProgressionNav openSettings={() => setOpen(true)} />
      {open && (
        <dialog
          ref={ref}
          onClose={() => setOpen(false)}
          aria-label="Session settings"
          className="m-auto max-h-[90vh] w-[min(95vw,1100px)] overflow-auto rounded-xl bg-panel text-white backdrop:bg-black/75"
        >
          <form
            method="dialog"
            className="sticky top-0 z-10 flex justify-end bg-panel p-3"
          >
            <button className="action">Return to game</button>
          </form>
          <Settings />
        </dialog>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <PlayerPreferences />
      <PartyRouteLifecycle />
      <SettingsNavigation />
      <Routes>
        <Route path="/settings" element={<Settings />} />
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
