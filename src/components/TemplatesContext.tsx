'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { TASK_TEMPLATE_CATEGORY } from '@/lib/types';

/**
 * Shape of a single template entry — mirrors the Template interface in
 * src/app/playbook/page.tsx. We keep a duplicate type here so the launch
 * detail page can read templates without pulling in the whole playbook
 * module.
 */
export interface TemplateRecord {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  addedAt: string;
}

interface TemplatesContextValue {
  templates: TemplateRecord[];
  getTemplateForTask: (taskName: string) => TemplateRecord | null;
}

export const TemplatesContext = createContext<TemplatesContextValue>({
  templates: [],
  getTemplateForTask: () => null,
});

const TEMPLATES_STORAGE_KEY = 'ee-gtm-templates';

export function TemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);

  useEffect(() => {
    // Read from localStorage first for instant hydration, then reconcile with
    // the API so we always end up with the canonical saved-to-disk version.
    try {
      const cached = localStorage.getItem(TEMPLATES_STORAGE_KEY);
      if (cached) setTemplates(JSON.parse(cached));
    } catch {}

    fetch('/api/data/templates')
      .then(res => res.json())
      .then(data => {
        try {
          const parsed = data.value ? JSON.parse(data.value) : [];
          if (Array.isArray(parsed)) {
            setTemplates(parsed);
            localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(parsed));
          }
        } catch {}
      })
      .catch(() => {});
  }, []);

  /**
   * Look up the template entry that should be used as the starting point
   * for a given task. We prefer the entry whose name ends with
   * "- Template" (vs "- Example") so the user always starts from the blank
   * template, not the filled-in reference.
   */
  function getTemplateForTask(taskName: string): TemplateRecord | null {
    const category = TASK_TEMPLATE_CATEGORY[taskName];
    if (!category) return null;
    const matches = templates.filter(t => t.category === category);
    if (matches.length === 0) return null;
    const preferred = matches.find(t => /-\s*Template/i.test(t.name) && t.url);
    if (preferred) return preferred;
    const anyWithUrl = matches.find(t => t.url);
    return anyWithUrl || matches[0];
  }

  return (
    <TemplatesContext.Provider value={{ templates, getTemplateForTask }}>
      {children}
    </TemplatesContext.Provider>
  );
}

/**
 * Hook that returns the template record associated with a given task name
 * (or null if none). Components use this to decide whether to show the
 * "Start from template" action on a task row.
 */
export function useTaskTemplate(taskName: string): TemplateRecord | null {
  const { getTemplateForTask } = useContext(TemplatesContext);
  return getTemplateForTask(taskName);
}
