import { Link, NavLink } from 'react-router-dom'

import { cn } from '@/lib/utils'

const MARKETING_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '#' },
  { label: 'Blogs', path: '#' },
  { label: "Let's Connect", path: '#' },
] as const

export function LandingPageHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/20 px-4 pt-3 pb-0 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
        <NavLink
          to="/"
          end
          aria-label="HIVOCO STUDIOS home"
          className="inline-flex items-center"
        >
          <img src="/hv-logo.png" alt="HIVOCO STUDIOS" className="size-15" />
        </NavLink>

        <nav
          aria-label="Primary"
          className="flex items-center rounded-full bg-black p-1.5"
        >
          {MARKETING_LINKS.map((link) =>
            link.path === '#' ? (
              <a
                key={link.label}
                href="#"
                className="rounded-full px-5 py-2 text-sm font-normal text-white/90 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.label}
                to={link.path}
                className={({ isActive }) =>
                  cn(
                    'rounded-full px-5 py-2 text-sm font-normal transition-colors',
                    isActive
                      ? 'bg-hv-green text-black'
                      : 'text-white/90 hover:text-white',
                  )
                }
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <Link
          to="/login"
          className="inline-flex items-center rounded-full bg-black px-6 py-3 text-sm font-semibold tracking-wide text-white transition hover:bg-neutral-800"
        >
          SIGN UP
        </Link>
      </div>
    </header>
  )
}
