/**
 * A spinner in the middle of the screen. `label` isn't shown, only read out by screen readers.
 * The same markup is in index.html, shown until the app has loaded, so the spinner doesn't jump
 * between steps. Its styles live in index.html too, since they're needed before styles.css loads.
 */
export function Loading({ label }: { label?: string }) {
  return (
    <div className="loading" role="status" aria-label={label}>
      <span className="spinner" aria-hidden="true" />
    </div>
  );
}
