import type { SaasModulesMap } from './saasModuleKeys';
import {
  ACADEMIC_SIDEBAR_LABEL_TO_KEY,
} from './saasAcademicSubmodules';
import { isAcademicSubmoduleMenuVisible } from './saasModuleAccess';

const SUBMENU_ITEM_MODULE: Record<string, string> = {
  'Fees Collection': 'fees',
  Library: 'library',
  Hostel: 'hostel',
  Transport: 'transport',
};

function sectionModuleKey(sectionLabel: string): string | null {
  const map: Record<string, string> = {
    MAIN: 'main',
    People: 'peoples',
    Academic: 'academic',
    MANAGEMENT: 'management',
    HRM: 'hrm',
    'Finance & Accounts': 'accounts',
    Reports: 'reports',
    'USER MANAGEMENT': 'user_management',
    MEMBERSHIP: 'membership',
    Settings: 'settings',
    REMOVE: 'extras',
  };
  return map[sectionLabel] || null;
}

function extrasAllows(
  modules: SaasModulesMap | undefined,
  keys: string[]
): boolean {
  if (!modules) return true;
  return keys.some((k) => modules[k]?.show_in_menu !== false);
}

function filterAcademicSubmenuItems(
  items: any[],
  modules: SaasModulesMap | undefined
): any[] {
  if (!modules) return items;
  return (items || []).filter((item: any) => {
    const subKey = ACADEMIC_SIDEBAR_LABEL_TO_KEY[item.label];
    if (!subKey) return true;
    return isAcademicSubmoduleMenuVisible(modules, subKey);
  });
}

function filterSubmenuItems(
  items: any[],
  modules: SaasModulesMap | undefined
): any[] {
  if (!modules) return items;
  return (items || []).filter((item) => {
    const mk = SUBMENU_ITEM_MODULE[item.label];
    if (mk) {
      return modules[mk]?.show_in_menu !== false;
    }
    return true;
  });
}

/**
 * Filters Headmaster-style sidebar trees using SaaS module flags from /auth/me.
 * When `modules` is undefined, returns data unchanged (backward compatible).
 */
export function filterSidebarBySaasModules(sidebarData: any[], modules: SaasModulesMap | undefined): any[] {
  if (!modules || !Array.isArray(sidebarData)) return sidebarData;

  return sidebarData
    .map((section) => {
      const secKey = sectionModuleKey(section.label);
      if (secKey === 'main') {
        return section;
      }
      if (secKey === 'management') {
        const nextItems = filterSubmenuItems(section.submenuItems, modules);
        if (!nextItems.length) return null;
        return { ...section, submenuItems: nextItems };
      }
      if (secKey === 'extras') {
        const items = (section.submenuItems || []).filter((item: any) => {
          if (item.label === 'Application') return modules.application?.show_in_menu !== false;
          if (item.label === 'Notice Board' || item.label === 'Events') {
            return modules.announcements?.show_in_menu !== false;
          }
          if (item.label === 'Sports' || item.label === 'Players') {
            return modules.sports?.show_in_menu !== false;
          }
          if (item.label === 'Content') return modules.content?.show_in_menu !== false;
          if (item.label === 'Pages') return true;
          return extrasAllows(modules, ['application', 'announcements', 'sports', 'content']);
        });
        if (!items.length) return null;
        return { ...section, submenuItems: items };
      }
      if (secKey === 'academic') {
        if (modules.academic?.show_in_menu === false) {
          return null;
        }
        const filteredItems = filterAcademicSubmenuItems(section.submenuItems, modules);
        if (!filteredItems.length) return null;
        return { ...section, submenuItems: filteredItems };
      }
      if (secKey && secKey !== 'management') {
        const mod =
          secKey === 'peoples'
            ? modules.peoples
            : secKey === 'hrm'
                ? modules.hrm
                : secKey === 'accounts'
                  ? modules.accounts
                  : secKey === 'reports'
                    ? modules.reports
                    : secKey === 'user_management'
                      ? modules.user_management
                      : secKey === 'membership'
                        ? modules.membership
                        : secKey === 'settings'
                          ? modules.settings
                          : null;
        if (mod && mod.show_in_menu === false) {
          return null;
        }
      }
      return section;
    })
    .filter(Boolean) as any[];
}
