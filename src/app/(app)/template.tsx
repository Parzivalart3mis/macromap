// Remounts on every route change, giving each page a soft entrance.
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return <div className="animate-page">{children}</div>;
}
