export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="top-header app-chrome glass sticky top-0 z-30 border-b border-border/60 px-4 pb-3">
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {action}
      </div>
    </header>
  );
}
