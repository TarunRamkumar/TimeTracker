'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { CategoryForm, ProjectForm } from '@/components/forms';
import { useAppData } from '@/components/providers/AppDataProvider';
import { useCategories } from '@/components/providers/CategoriesProvider';
import { TIMER_PRESETS } from '@/lib/domain/constants';
import {
  formatCurrency,
  getCategoryParentLabels,
  getCategoryPathLabel,
} from '@/lib/domain/helpers';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import { PageShell } from '@/components/layout/PageShell';
import { useCategoryForm, useProjectForm } from '@/hooks/useForms';
import { buildCategoryFromFormValues, buildProjectFromFormValues } from '@/lib/forms/mappers';
import type { CategoryFormValues, ProjectFormValues } from '@/lib/forms/schemas';
import { INTEGRATION_CATALOG, INTEGRATION_ORDER } from '@/lib/integrations';
import { MOCK_INTEGRATION_ACCOUNTS } from '@/lib/mock/integrations';
import { Check, AlertCircle, ChevronRight } from 'lucide-react';
import type { Category, Project } from '@/lib/domain/types';

export default function Settings() {
  const [pomodoroTime, setPomodoroTime] = useState<number>(TIMER_PRESETS.pomodoro);
  const { categories, setCategories } = useCategories();
  const {
    tags,
    tasks,
    timeBlocks,
    projects,
    upsertProject,
    deleteProject,
    upsertTask,
    upsertTimeBlock,
  } = useAppData();
  const categoryForm = useCategoryForm<Category>();
  const projectForm = useProjectForm<Project>();

  const integrations = INTEGRATION_ORDER.map((provider) => ({
    ...INTEGRATION_CATALOG[provider],
    account: MOCK_INTEGRATION_ACCOUNTS[provider],
  }));
  const connectedIntegrations = integrations.filter(
    (integration) => integration.account.status === 'connected'
  ).length;

  const handleCategorySubmit = async (data: CategoryFormValues) => {
    const nextCategory = buildCategoryFromFormValues(data, categoryForm.initialData);

    setCategories((currentCategories) => {
      const exists = currentCategories.some((category) => category.id === nextCategory.id);
      if (!exists) {
        return [...currentCategories, nextCategory];
      }

      return currentCategories.map((category) =>
        category.id === nextCategory.id ? nextCategory : category
      );
    });
  };

  const handleCategoryDelete = async () => {
    const categoryId = categoryForm.initialData?.id;
    if (!categoryId) {
      return;
    }

    const category = categories.find((item) => item.id === categoryId);
    const remainingCategories = categories.filter((item) => item.id !== categoryId);
    const reassignedCategoryId = category?.parentCategoryIds?.[0] ?? remainingCategories[0]?.id;

    if (
      !reassignedCategoryId &&
      (projects.some((project) => project.categoryId === categoryId) ||
        tasks.some((task) => task.categoryId === categoryId) ||
        timeBlocks.some((block) => block.categoryId === categoryId))
    ) {
      window.alert('Create another category before deleting the last one used by projects or work.');
      return;
    }

    if (reassignedCategoryId) {
      projects
        .filter((project) => project.categoryId === categoryId)
        .forEach((project) => upsertProject({ ...project, categoryId: reassignedCategoryId }));

      tasks
        .filter((task) => task.categoryId === categoryId && !task.projectId)
        .forEach((task) =>
          upsertTask({
            ...task,
            categoryId: reassignedCategoryId,
            updatedAt: new Date(),
          })
        );

      timeBlocks
        .filter((block) => block.categoryId === categoryId && !block.taskId)
        .forEach((block) =>
          upsertTimeBlock({
            ...block,
            categoryId: reassignedCategoryId,
          })
        );
    }

    setCategories((currentCategories) =>
      currentCategories
        .map((currentCategory) =>
          currentCategory.parentCategoryIds?.includes(categoryId)
            ? {
                ...currentCategory,
                parentCategoryIds: [
                  ...new Set([
                    ...(currentCategory.parentCategoryIds ?? []).filter((id) => id !== categoryId),
                    ...(category?.parentCategoryIds ?? []),
                  ]),
                ].filter((id) => id !== currentCategory.id),
              }
            : currentCategory
        )
        .filter((currentCategory) => currentCategory.id !== categoryId)
    );
  };

  const handleProjectSubmit = async (data: ProjectFormValues) => {
    const nextProject = buildProjectFromFormValues(data, projectForm.initialData);
    upsertProject(nextProject);
  };

  const handleProjectDelete = async () => {
    const projectId = projectForm.initialData?.id;
    if (!projectId) {
      return;
    }

    deleteProject(projectId);
  };

  return (
    <PageShell>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your preferences and integrations</p>
      </div>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categories.map((category) => {
              const parentLabels = getCategoryParentLabels(categories, category.id);

              return (
                <div
                  key={category.id}
                  className="p-4 rounded-lg border border-gray-200 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                    <div>
                      <p className="font-medium text-gray-900">{category.name}</p>
                      <p className="text-xs text-gray-600">
                        {category.active ? 'Active' : 'Inactive'}
                        {typeof category.hourlyRate === 'number'
                          ? ` • ${formatCurrency(category.hourlyRate, category.currency)} / hr default`
                          : ''}
                      </p>
                      {parentLabels.length > 0 ? (
                        <p className="text-xs text-gray-500">
                          Parents: {parentLabels.join(' • ')}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    onClick={() => categoryForm.openEdit(category)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                </div>
              );
            })}
          </div>
          <Button
            variant="secondary"
            className="w-full mt-4"
            onClick={() => categoryForm.openCreate()}
          >
            + Add Category
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-600">
                No projects yet. Create one to get a dedicated task board and shared category
                inheritance.
              </div>
            ) : (
              projects.map((project) => (
                <div
                  key={project.id}
                  className="rounded-lg border border-gray-200 p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{project.name}</p>
                      <Badge variant="default" className="capitalize">
                        {project.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{project.description || 'No description'}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {getCategoryPathLabel(categories, project.categoryId)}
                      {' • '}
                      {tasks.filter((task) => task.projectId === project.id).length} task
                      {tasks.filter((task) => task.projectId === project.id).length === 1 ? '' : 's'}
                    </p>
                    {project.startDate || project.endDate ? (
                      <p className="mt-1 text-xs text-gray-500">
                        {project.startDate ? `Starts ${format(project.startDate, 'MMM d, yyyy')}` : 'No start date'}
                        {' • '}
                        {project.endDate ? `Ends ${format(project.endDate, 'MMM d, yyyy')}` : 'No end date'}
                      </p>
                    ) : null}
                  </div>
                  <button
                    onClick={() => projectForm.openEdit(project)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Edit
                  </button>
                </div>
              ))
            )}
          </div>
          <Button
            variant="secondary"
            className="w-full mt-4"
            onClick={() => projectForm.openCreate()}
          >
            + Add Project
          </Button>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag) => (
              <Badge key={tag.id} variant="default" className="px-3 py-1.5">
                {tag.name}
                <button className="ml-2 text-xs hover:opacity-70">×</button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New tag name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <Button variant="secondary">Add</Button>
          </div>
        </CardContent>
      </Card>

      {/* Timer Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Timer Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pomodoro Duration (minutes)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="5"
                  max="60"
                  value={pomodoroTime}
                  onChange={(e) => setPomodoroTime(Number(e.target.value))}
                  className="flex-1"
                />
                <input
                  type="number"
                  value={pomodoroTime}
                  onChange={(e) => setPomodoroTime(Math.max(5, Math.min(60, Number(e.target.value))))}
                  className="w-16 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Current: {pomodoroTime} minutes
              </p>
            </div>

            <div className="pt-4 border-t border-gray-200">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm text-gray-700">Auto-start break after Pomodoro</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-sm text-gray-700">Send browser notifications</span>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader>
          <CardTitle>Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {integrations.map((integration) => (
              <div
                key={integration.provider}
                className="p-4 rounded-lg border border-gray-200 flex items-center justify-between hover:shadow-sm transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <p className="font-medium text-gray-900">{integration.displayName}</p>
                    <p className="text-xs text-gray-600">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {integration.account.status === 'connected' ? (
                    <Badge variant="success" className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connected
                    </Badge>
                  ) : integration.account.status === 'syncing' ? (
                    <Badge variant="info">Syncing</Badge>
                  ) : integration.account.status === 'error' ? (
                    <Badge variant="warning">Error</Badge>
                  ) : (
                    <Badge variant="error">Disconnected</Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Integration Status</p>
              <p className="text-xs mt-1">
                {connectedIntegrations} of {integrations.length} providers currently have a mock
                connected account. Live auth and network sync are intentionally not enabled in
                Phase 1.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                defaultValue="Alex Student"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                defaultValue="alex@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>America/New_York</option>
                <option>America/Chicago</option>
                <option>America/Los_Angeles</option>
                <option>Europe/London</option>
                <option>Europe/Paris</option>
                <option>Asia/Tokyo</option>
              </select>
            </div>

            <Button variant="primary" className="w-full">
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <CategoryForm
        open={categoryForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            categoryForm.close();
          }
        }}
        mode={categoryForm.mode}
        initialData={categoryForm.initialData}
        categories={categories}
        onSubmit={handleCategorySubmit}
        onDelete={handleCategoryDelete}
      />
      <ProjectForm
        open={projectForm.isOpen}
        onOpenChange={(open) => {
          if (!open) {
            projectForm.close();
          }
        }}
        mode={projectForm.mode}
        initialData={projectForm.initialData}
        categories={categories}
        onSubmit={handleProjectSubmit}
        onDelete={handleProjectDelete}
      />
    </PageShell>
  );
}
