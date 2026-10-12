import { getDashboardSnapshot } from '@/lib/supabase/dashboard';
import { connection } from 'next/server';

export default async function TodosPage() {
  await connection();

  const snapshot = await getDashboardSnapshot();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          Supabase Snapshot
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Relational Overview
        </h1>
        <p className="text-sm text-muted-foreground">
          Source: {snapshot.source === 'supabase' ? 'Supabase tables' : 'Local fallback'}
        </p>
      </div>

      <ul className="space-y-3">
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Categories: {snapshot.categories.length}
        </li>
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Tags: {snapshot.tags.length}
        </li>
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Projects: {snapshot.projects.length}
        </li>
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Tasks: {snapshot.tasks.length}
        </li>
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Time blocks: {snapshot.timeBlocks.length}
        </li>
        <li className="rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-card-foreground shadow-sm">
          Timer sessions: {snapshot.timerSessions.length}
        </li>
      </ul>
    </main>
  );
}
