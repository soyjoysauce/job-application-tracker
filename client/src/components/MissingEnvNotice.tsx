// Shown instead of the app when the bundle was built without its environment variables.
export function MissingEnvNotice({ missing }: { missing: string[] }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-lg rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-red-700">Configuration missing</h1>
        <p className="mt-2 text-sm text-slate-700">
          This build was created without the following environment{' '}
          {missing.length === 1 ? 'variable' : 'variables'}:
        </p>
        <ul className="mt-2 list-inside list-disc font-mono text-sm text-slate-900">
          {missing.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-600">
          Set them in the hosting project&rsquo;s settings (or <code>client/.env</code> locally) and
          build again. Values are baked in at build time, so a redeploy is required — restarting
          won&rsquo;t pick them up.
        </p>
      </div>
    </div>
  );
}
