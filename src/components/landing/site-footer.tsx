import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative border-t border-white/10 px-6 py-14">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[image:var(--gradient-brand)] text-lg font-black text-white shadow-[var(--shadow-glow)]">
              M
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Macro
              <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Map
              </span>
            </span>
          </div>
          <p className="mt-4 text-sm text-white/50">
            Fast, precise nutrition tracking — meals, chain-store orders, custom builds,
            and goals that adapt to your week.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-10 text-sm sm:gap-16">
          <div>
            <p className="font-semibold text-white/80">Get started</p>
            <ul className="mt-3 space-y-2 text-white/50">
              <li>
                <Link href="/sign-up" className="transition-colors hover:text-white">
                  Create account
                </Link>
              </li>
              <li>
                <Link href="/sign-in" className="transition-colors hover:text-white">
                  Sign in
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-white/80">Companion apps</p>
            <ul className="mt-3 space-y-2 text-white/50">
              <li>Iron Log — training</li>
              <li>The Cookbook — recipes</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-6xl border-t border-white/10 pt-6 text-xs text-white/40">
        © {new Date().getFullYear()} MacroMap. Built for people who track seriously.
      </div>
    </footer>
  );
}
