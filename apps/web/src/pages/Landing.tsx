import { Link } from "react-router-dom";

export function Landing() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-[20vh]">
      <h1 className="mb-6 font-serif text-5xl font-semibold text-iris">
        The Obsidian Abyss
      </h1>
      <nav aria-label="Game previews" className="flex flex-wrap gap-3">
        <Link className="action" to="/characters">
          Select Wizard
        </Link>
        <Link className="action" to="/dungeon">
          Explore dungeon
        </Link>
        <Link className="action" to="/playground">
          Open playground
        </Link>
      </nav>
    </main>
  );
}
