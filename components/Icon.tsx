export type IconName =
  | "assessment" | "symptoms" | "knowledge" | "nutrition"
  | "ent" | "session" | "measurements" | "sources";

const paths: Record<IconName, React.ReactNode> = {
  assessment: <><path d="M4 5h16v14H4z"/><path d="M8 9h8M8 13h5"/></>,
  symptoms: <><path d="M12 3v18M8 6h8M7 11h10M8 16h8"/><circle cx="12" cy="3" r="1"/></>,
  knowledge: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22z"/></>,
  nutrition: <><path d="M12 21c4-3 7-7 7-12-4 0-8 2-10 5-1 2-1 5 3 7z"/><path d="M5 21c1-4 3-7 7-10"/></>,
  ent: <><path d="M14 20c0-3 4-3 4-8a6 6 0 1 0-12 0"/><path d="M10 15c0-2 4-2 4-5a2 2 0 1 0-4 0"/></>,
  session: <><circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/></>,
  measurements: <><path d="M4 19V5h16v14z"/><path d="M8 5v4M12 5v2M16 5v4"/></>,
  sources: <><path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
};

export function Icon({name}: {name: IconName}) {
  return <svg className="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
