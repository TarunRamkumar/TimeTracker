import { AppDataProvider } from '@/components/providers/AppDataProvider';
import { CategoriesProvider } from '@/components/providers/CategoriesProvider';
import { SupabaseSync } from '@/components/providers/SupabaseSync';
import { MainLayout } from '@/components/layout/MainLayout';
import { getDashboardBootstrapData } from '@/lib/supabase/dashboard';
import { connection } from 'next/server';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();

  const bootstrap = await getDashboardBootstrapData();
  const preferLocalStateOnBoot =
    bootstrap.source === 'fallback' ||
    (bootstrap.tasks.length === 0 &&
      bootstrap.timeBlocks.length === 0 &&
      bootstrap.timerSessions.length === 0);

  return (
    <CategoriesProvider
      initialCategories={bootstrap.categories}
      preferLocalStateOnBoot={preferLocalStateOnBoot}
    >
      <AppDataProvider
        initialDataJson={bootstrap.initialAppDataJson}
        initialProjects={bootstrap.projects}
        initialTags={bootstrap.tags}
        preferLocalStateOnBoot={preferLocalStateOnBoot}
      >
        <SupabaseSync />
        <MainLayout>{children}</MainLayout>
      </AppDataProvider>
    </CategoriesProvider>
  );
}
