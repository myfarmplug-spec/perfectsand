export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
      <div className="max-w-sm space-y-4">
        <p className="text-xs uppercase tracking-[0.28em] text-sand-300/78">Perfect Sand</p>
        <h1 className="text-3xl font-semibold text-white">You are offline for now</h1>
        <p className="text-sm text-ink-100/72">
          Local logging still works. We go sync when network returns.
        </p>
      </div>
    </main>
  );
}
