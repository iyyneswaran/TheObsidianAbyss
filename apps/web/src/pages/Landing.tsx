import { Link } from "react-router-dom";

export function Landing() {
  return (
    <main className="abyss-entry">
      <div className="entry-art" aria-hidden="true" />
      <div className="entry-copy">
        <p className="entry-kicker">A co-operative dungeon expedition</p>
        <h1 className="entry-title">The Obsidian Abyss</h1>
        <p className="entry-detail">
          Gather your wizards and descend through five regions to the throne of
          the Shadow Overlord.
        </p>
        <nav aria-label="Game previews" className="flex flex-wrap gap-3">
          <Link className="action" to="/characters">
            Select Wizard
          </Link>
          <Link className="action" to="/party">
            Private teams
          </Link>
          <Link className="action" to="/dungeon">
            Explore dungeon
          </Link>
          <Link className="action" to="/playground">
            Open playground
          </Link>
        </nav>
      </div>
    </main>
  );
}
