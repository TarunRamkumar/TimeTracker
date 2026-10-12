import { Project, ProjectId, Tag, TagId, Task } from '../domain/types';
import { createCategoryId, createProjectId, createTagId } from '../domain/constants';

export const MOCK_TAGS: Tag[] = [
  { id: createTagId('tag-urgent') as TagId, name: 'Urgent', color: '#EF4444' },
  { id: createTagId('tag-meeting') as TagId, name: 'Meeting', color: '#3B82F6' },
  { id: createTagId('tag-review') as TagId, name: 'Review', color: '#8B5CF6' },
  { id: createTagId('tag-bug') as TagId, name: 'Bug', color: '#F97316' },
  { id: createTagId('tag-feature') as TagId, name: 'Feature', color: '#10B981' },
  { id: createTagId('tag-documentation') as TagId, name: 'Documentation', color: '#6366F1' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: createProjectId('proj-website') as ProjectId,
    name: 'Website Redesign',
    description: 'Q2 website modernization',
    status: 'active',
    categoryId: createCategoryId('cat-work'),
  },
  {
    id: createProjectId('proj-api') as ProjectId,
    name: 'API Integration',
    description: 'Third-party API integrations',
    status: 'active',
    categoryId: createCategoryId('cat-work'),
  },
  {
    id: createProjectId('proj-ml') as ProjectId,
    name: 'ML Research',
    description: 'Research project at internship',
    status: 'active',
    categoryId: createCategoryId('cat-internship'),
  },
  {
    id: createProjectId('proj-fitness') as ProjectId,
    name: 'Fitness Goals',
    description: 'Personal fitness tracking',
    status: 'active',
    categoryId: createCategoryId('cat-sports'),
  },
];

export const MOCK_TASKS: Task[] = [];
