import { NextResponse } from 'next/server';
import type { SupabaseSyncPayload } from '@/lib/app-data/sync';
import { syncSnapshotToSupabase } from '@/lib/supabase/write';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SupabaseSyncPayload;

    await syncSnapshotToSupabase(payload);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to sync app data to Supabase.', error);

    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown sync failure',
      },
      { status: 500 }
    );
  }
}
