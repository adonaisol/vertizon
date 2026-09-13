import { useState } from "react";

export function KeyDialog({ open, onClose, onSave, hasKey }: { open: boolean; onClose: () => void; onSave: (key: string | null) => void; hasKey: boolean }) {
  const [value, setValue] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">Anthropic API key</h2>
        <p className="mt-1 text-xs text-slate-600">
          Used only to re-run an extraction live from your browser to <code>api.anthropic.com</code>. Kept in memory for this tab and
          forgotten on reload; never written to storage or sent anywhere else.
        </p>
        <input
          type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="sk-ant-…"
          className="mt-3 w-full rounded border border-slate-300 px-2 py-1 text-sm" autoFocus
        />
        <div className="mt-3 flex justify-end gap-2 text-sm">
          {hasKey && <button onClick={() => { onSave(null); onClose(); }} className="px-2 py-1 text-slate-600 hover:underline">Forget key</button>}
          <button onClick={onClose} className="px-2 py-1 text-slate-600 hover:underline">Cancel</button>
          <button onClick={() => { if (value.trim()) { onSave(value.trim()); setValue(""); onClose(); } }} className="rounded bg-slate-800 px-3 py-1 text-white">Use key</button>
        </div>
      </div>
    </div>
  );
}
