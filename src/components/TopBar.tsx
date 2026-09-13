export function TopBar({ hasKey, onKeyClick }: { hasKey: boolean; onKeyClick: () => void }) {
  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-slate-200 px-6 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="text-lg font-semibold text-slate-900">Calibration Map</h1>
        <p className="text-sm text-slate-600">
          Is this rating a property of the evidence, or of who wrote it? Each point is one employee: how strong the written
          evidence is (across) against the rating their manager gave (up).
        </p>
      </div>
      <button
        onClick={onKeyClick}
        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
        title="Add an Anthropic API key to re-run extractions live"
      >
        {hasKey ? "🔑 key set" : "🔑 add key"}
      </button>
    </header>
  );
}
