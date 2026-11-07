const base = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
export const SearchIcon = () => <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></svg>;
export const UserIcon = () => <svg {...base}><circle cx="12" cy="8" r="3.5" /><path d="M5 20c1.2-3.6 3.8-5.2 7-5.2s5.800 1.600 7 5.200" /></svg>;
export const BagIcon = () => <svg {...base}><path d="M6 8h12l1 12H5L6 8Z" /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></svg>;
export const MenuIcon = () => <svg {...base}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CloseIcon = () => <svg {...base}><path d="m6 6 12 12M18 6 6 18" /></svg>;
export const ChevronIcon = () => <svg {...base} width={14} height={14}><path d="m6 9 6 6 6-6" /></svg>;
