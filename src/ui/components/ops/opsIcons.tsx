// Line icons for the Operations Console, drawn as in the Claude Design mockup (docs/design/Ops Console Desktop.dc.html).
type P = { size?: number };
const sv = (size: number, vb = 16) => ({ width: size, height: size, viewBox: `0 0 ${vb} ${vb}`, fill: 'none', 'aria-hidden': true as const });

export const RadioIcon = ({ size = 22, off = false }: P & { off?: boolean }) => (
  <svg {...sv(size, 20)}>
    <circle cx="10" cy="11" r="1.8" fill="currentColor" />
    <path d="M6.5 7.5a5 5 0 0 0 0 7M13.5 7.5a5 5 0 0 1 0 7M4 5a8.5 8.5 0 0 0 0 12M16 5a8.5 8.5 0 0 1 0 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity={off ? 0.5 : 1} />
    {off && <path d="M3 3l14 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
);

export const DishIcon = ({ size = 15 }: P) => (
  <svg {...sv(size)}>
    <path d="M2 6q6 7 12 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8 9.5V14M5 14h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const BurnIcon = ({ size = 15 }: P) => (
  <svg {...sv(size)}>
    <path d="M5.5 1.5h5v5l1.5 3h-8l1.5-3z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M6.5 11.5L8 15l1.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const SunIcon = ({ size = 14 }: P) => (
  <svg {...sv(size)}>
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const EclipseIcon = ({ size = 14 }: P) => (
  <svg {...sv(size)}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" />
  </svg>
);

export const CameraIcon = ({ size = 13 }: P) => (
  <svg {...sv(size)}>
    <rect x="1.5" y="4.5" width="13" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.5" />
    <path d="M5.5 4.5l1-2h3l1 2" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const CoinIcon = ({ size = 13 }: P) => (
  <svg {...sv(size)}>
    <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const FuelIcon = ({ size = 13 }: P) => (
  <svg {...sv(size)}>
    <path d="M8 1.8S3.5 7.2 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.2 8 1.8 8 1.8z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const BatteryIcon = ({ size = 13 }: P) => (
  <svg {...sv(size)}>
    <rect x="1.5" y="4.5" width="11.5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M14.5 7v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <rect x="3.5" y="6.5" width="4" height="3" fill="currentColor" />
  </svg>
);

export const PowerPlanIcon = ({ size = 22 }: P) => (
  <svg {...sv(size, 22)}>
    <circle cx="11" cy="11" r="8.5" stroke="currentColor" strokeWidth="1.6" />
    <path d="M11 11V2.5M11 11l7.4 4.2M11 11l-7.4 4.2" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

export const CallIcon = ({ size = 22 }: P) => (
  <svg {...sv(size, 22)}>
    <path d="M3 8q8 9 16 0z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M11 12.5V19M7 19h8M11 9.5l4-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const QueueIcon = ({ size = 22 }: P) => (
  <svg {...sv(size, 22)}>
    <path d="M4 6h10M4 11h10M4 16h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M16 14l4 2.5-4 2.5z" fill="currentColor" />
  </svg>
);

export const AlertIcon = ({ size = 14 }: P) => (
  <svg {...sv(size, 14)}>
    <path d="M4.6 1h4.8L13 4.6v4.8L9.4 13H4.6L1 9.4V4.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M7 4v3.6M7 9.8v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const BlockIcon = ({ size = 12 }: P) => (
  <svg {...sv(size, 14)}>
    <path d="M4.6 1h4.8L13 4.6v4.8L9.4 13H4.6L1 9.4V4.6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M5 5l4 4M9 5l-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const HistoryIcon = ({ size = 18 }: P) => (
  <svg {...sv(size, 18)}>
    <path d="M3 2.5h9l3 3v10H3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M6 8h6M6 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export const SendIcon = ({ size = 16 }: P) => (
  <svg {...sv(size)}>
    <path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const SkipIcon = ({ size = 14 }: P) => (
  <svg {...sv(size)}>
    <path d="M2 3l6 5-6 5zM8 3l6 5-6 5z" fill="currentColor" />
  </svg>
);

export const PauseIcon = ({ size = 12 }: P) => (
  <svg {...sv(size, 12)}>
    <rect x="2" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
    <rect x="7" y="1.5" width="3" height="9" rx="1" fill="currentColor" />
  </svg>
);

export const RetireIcon = ({ size = 24 }: P) => (
  <svg {...sv(size, 24)}>
    <circle cx="12" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
    <path d="M8.5 14l-2 8 5.5-3 5.5 3-2-8" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export const ExtendIcon = ({ size = 24 }: P) => (
  <svg {...sv(size, 24)}>
    <path d="M4 18L12 6l8 12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M12 6V2M9 4l3-2 3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RecoverIcon = ({ size = 18 }: P) => (
  <svg {...sv(size, 20)}>
    <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
