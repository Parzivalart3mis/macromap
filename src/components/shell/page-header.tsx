export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="top-header app-chrome sticky top-0 z-30 border-b bg-background/95 px-4 pb-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3 pt-2">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        {action}
      </div>
    </header>
  );
}
