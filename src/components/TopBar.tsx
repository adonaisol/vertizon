export function TopBar({ hasKey, onKeyClick, onHelpClick }: { hasKey: boolean; onKeyClick: () => void; onHelpClick: () => void }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 border-b border-slate-200 px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">Calibration Map</h1>
        <p className="mt-0.5 text-sm text-slate-600">
          Checks each performance rating against the written evidence behind it, so a calibration meeting can spend its
          time on the ratings that need discussion.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onHelpClick}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          title="How to read this page"
          aria-label="Help: how to read this page"
        >
          ? help
        </button>
        <button
          type="button"
          onClick={onKeyClick}
          className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
          title="Add an Anthropic API key to re-run extractions live"
        >
          {hasKey ? "🔑 key set" : "🔑 add key"}
        </button>
      </div>
    </header>
  );
}
