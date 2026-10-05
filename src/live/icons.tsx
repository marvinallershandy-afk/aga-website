// v15-L: kleine Inline-SVG-Icons der Live-Seite (kein Icon-Paket im Bundle).
type Name =
  | 'ball' | 'gelb' | 'gelbrot' | 'rot' | 'wechsel' | 'kommentar' | 'elfmeter'
  | 'pfeife' | 'teilen' | 'route' | 'offline' | 'tabelle' | 'cube'

export function Icon({ name, size = 18 }: { name: Name; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const }
  switch (name) {
    case 'cube':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="M4 7.5l8 4.5 8-4.5M12 12v9" />
        </svg>
      )
    case 'ball':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5l3.6 2.6-1.4 4.3H9.8L8.4 10.1z" fill="currentColor" stroke="none" />
          <path d="M12 3v4.5M20.4 9.3l-4.8.8M17.3 19.4l-3.1-5M6.7 19.4l3.1-5M3.6 9.3l4.8.8" />
        </svg>
      )
    case 'gelb':
      return <svg {...p}><rect x="7" y="3.5" width="10" height="15" rx="1.6" fill="#f5c518" transform="rotate(8 12 11)" /></svg>
    case 'rot':
      return <svg {...p}><rect x="7" y="3.5" width="10" height="15" rx="1.6" fill="#e91d29" transform="rotate(8 12 11)" /></svg>
    case 'gelbrot':
      return (
        <svg {...p}>
          <rect x="4.5" y="4" width="9" height="14" rx="1.5" fill="#f5c518" transform="rotate(-6 9 11)" />
          <rect x="10.5" y="5" width="9" height="14" rx="1.5" fill="#e91d29" transform="rotate(10 15 12)" />
        </svg>
      )
    case 'wechsel':
      return (
        <svg {...p} fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 20V5M4 9l4-4 4 4" stroke="#3ecf6e" />
          <path d="M16 4v15M12 15l4 4 4-4" stroke="#ff5560" />
        </svg>
      )
    case 'kommentar':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M4 5h16v11H9l-5 4z" />
        </svg>
      )
    case 'elfmeter':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M3 6h18v7H3z" />
          <circle cx="12" cy="18.5" r="2.3" fill="currentColor" />
        </svg>
      )
    case 'pfeife':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="14" r="5" />
          <path d="M12.5 10.5L21 7v4l-6.5 1.5M3 6l2 2M7 3.5l.6 2.6" />
        </svg>
      )
    case 'teilen':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12M7 8l5-5 5 5" />
          <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
      )
    case 'route':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
          <circle cx="12" cy="10" r="2.4" />
        </svg>
      )
    case 'offline':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
          <path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M3 3l18 18" />
        </svg>
      )
    case 'tabelle':
      return (
        <svg {...p} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3.5" y="4" width="17" height="16" rx="2" />
          <path d="M3.5 9h17M3.5 14h17M9 4v16" />
        </svg>
      )
  }
}
