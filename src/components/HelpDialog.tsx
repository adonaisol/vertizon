import { useEffect } from "react";

export function HelpDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-labelledby="help-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="help-title" className="text-base font-semibold text-slate-900">How to use the Calibration Map</h2>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:underline" aria-label="Close help">Close</button>
        </div>
        <p className="mt-2 text-sm text-slate-700">
          A calibration meeting asks whether ratings across teams mean the same thing. This page reframes that question:
          instead of comparing ratings with each other, it compares every rating with the <em>written evidence</em> in
          the review. Claude reads each review, quotes the concrete evidence it finds, and grades each quote against one
          shared rubric. Everything below is built from those graded quotes.
        </p>

        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <Section title="The map (left)">
            <p>
              One point per employee. <b>Across</b> is evidence strength, the average of the graded quotes on the
              rubric's scale (Below … Greatly Exceeds). <b>Up</b> is the rating the manager gave. The dashed diagonal
              is where rating and evidence agree.
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              <li>Points far <b>above</b> the diagonal are rated higher than their evidence supports; points far <b>below</b> are rated lower.</li>
              <li><b>Solid</b> points have enough evidence to judge. <b>Hollow</b> points come from reviews too thin to judge; they are shown for context but excluded from the manager lines.</li>
              <li>Each <b>coloured line</b> is one manager's fitted "rating given evidence" line. A line sitting above the others means that manager rates generously for the same evidence; below means harshly. A steeper line means the manager demands more evidence before moving up a rating.</li>
              <li>Click a manager in the row under the chart to hide or show their points and line. Click a point to open that employee.</li>
            </ul>
          </Section>

          <Section title="The agenda (right)">
            <p>
              The same employees, sorted into what the meeting should do with them. <b>Discuss</b>: the rating and the
              evidence disagree by a full step, or the evidence is strong in one area and weak in another so an average
              hides the shape. <b>Get more input</b>: the review does not contain enough concrete evidence to judge, so the
              first step is to ask the manager for specifics, not to argue about the rating. <b>Looks consistent</b>:
              rating and evidence agree. Each group can be collapsed independently. Click a row to open the employee.
            </p>
            <p className="mt-1">
              The manager legend at the top of the agenda summarises each manager's line in words, with the number of
              usable (solid) reviews behind it.
            </p>
          </Section>

          <Section title="Employee drilldown">
            <p>
              Shows the review with the quoted evidence highlighted by rubric dimension, and the evidence list with the
              level the model assigned to each quote. Click a quote to see the model's rationale. Change a level in the
              dropdown to <b>override</b> the model: the employee's strength, their point on the map, the manager lines
              and the agenda all recompute immediately. Overrides are marked in amber and can be reset per employee or
              for everyone at once from the chart header. Nothing is saved between reloads.
            </p>
          </Section>

          <Section title="Under other managers' bars">
            <p>
              Answers "what would this employee have been rated on another team?" by placing their evidence strength on
              each manager's fitted line. The band is the line's uncertainty: it widens when a manager is inconsistent
              or has never rated evidence this strong, and it is never narrower than half a rating step. Managers whose
              reviews are all too thin to judge have no line, so no estimate is shown for them.
            </p>
          </Section>

          <Section title="Re-run with Claude">
            <p>
              Every extraction shown was precomputed and is bundled with the app. "Re-run with Claude" sends the same
              prompt for one employee to Claude live and shows the result next to the bundled one, with dropped,
              added and re-levelled quotes marked. It needs an Anthropic API key, entered with the key button in the
              header; the key stays in memory for this tab only and is forgotten on reload. The bundled data is never
              replaced.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}
