import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { api, progression } from "./api";

export interface Balance {
  coins: number;
  gems: number;
}
export const panel = "rounded-xl border border-gold/35 bg-panel/90 p-5 sm:p-6";
export const field =
  "mt-1 w-full rounded border border-iris/40 bg-[#151429] px-3 py-2 text-slate-100";

export function ProgressionNav() {
  const { pathname } = useLocation();
  const [account, setAccount] = useState("");
  useEffect(() => {
    let active = true;
    void api<{ displayName: string; permanent: boolean } | null>(
      "/auth/session",
    )
      .then((session) => {
        if (active) setAccount(session?.permanent ? session.displayName : "");
      })
      .catch(() => {
        if (active) setAccount("");
      });
    return () => {
      active = false;
    };
  }, [pathname]);
  const links = [
    ["/party", "Play Online"],
    ["/characters", "Wizards"],
    ["/profile", "Profile"],
    ["/store", "Store"],
    ["/vault", "Vault"],
    ["/quests", "Quest Board"],
  ];
  return (
    <nav
      aria-label="Game navigation"
      className="flex flex-wrap gap-x-5 gap-y-2 border-b border-iris/20 bg-[#121121] px-5 py-3 text-sm"
    >
      <Link aria-label="Home" className="mr-auto font-serif text-gold" to="/">
        The Obsidian Abyss
      </Link>
      {links.map(([to, title]) => (
        <NavLink
          key={to}
          to={to!}
          className={({ isActive }) =>
            isActive ? "text-gold" : "text-slate-300 hover:text-white"
          }
        >
          {title}
        </NavLink>
      ))}
      {account && (
        <Link
          aria-label={"Signed in as " + account}
          to="/profile"
          className="rounded border border-gold/35 px-2 text-gold"
        >
          {account}
        </Link>
      )}
    </nav>
  );
}

export function WalletBadges({ balance }: { balance: Balance }) {
  return (
    <div
      aria-label="Wallet"
      className="flex flex-wrap items-center gap-2 text-sm font-semibold"
    >
      <span className="rounded-full border border-gold/40 bg-[#342919] px-3 py-1.5 text-[#f0cb7e]">
        <span aria-hidden>◉ </span>
        <span data-testid="wallet-coins">{balance.coins}</span> coins
      </span>
      <span className="rounded-full border border-iris/45 bg-[#2f2046] px-3 py-1.5 text-[#e2c6ff]">
        <span aria-hidden>◆ </span>
        <span data-testid="wallet-gems">{balance.gems}</span> gems
      </span>
    </div>
  );
}

export function PageShell({
  title,
  detail,
  badge,
  children,
}: {
  title: string;
  detail: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[1280px] px-5 py-8 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="font-serif text-4xl text-[#f2e6d4] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-2 text-sm text-slate-300">{detail}</p>
        </div>
        {badge}
      </header>
      {children}
    </main>
  );
}

export function usePageData<T>(path: string, refreshMs?: number) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void progression<T>(path)
        .then((value) => {
          if (active) {
            setData(value);
            setError("");
          }
        })
        .catch((cause: unknown) => {
          if (active)
            setError(
              cause instanceof Error
                ? cause.message
                : "Progression is unavailable.",
            );
        });
    refresh();
    const timer = refreshMs
      ? window.setInterval(refresh, refreshMs)
      : undefined;
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [path, refreshMs]);
  return { data, setData, error, setError };
}

export function Feedback({
  error,
  waiting = false,
}: {
  error: string;
  waiting?: boolean;
}) {
  if (error)
    return (
      <p
        role="alert"
        className="my-3 rounded-md border border-rose-400/45 bg-rose-900/25 p-3 text-sm text-rose-100"
      >
        {error}
      </p>
    );
  return waiting ? (
    <p role="status" className="text-sm text-slate-300">
      Loading…
    </p>
  ) : null;
}
