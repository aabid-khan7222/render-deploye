import type { SaasModulesMap } from './saasModuleKeys';
import { SAAS_MODULE_CATALOG } from './saasModuleKeys';
import {
  ACADEMIC_SUBMODULE_KEYS,
  getAcademicSubmoduleLabel,
  resolveAcademicSubmoduleKeyFromPath,
} from './saasAcademicSubmodules';

/** SaaS modules that can show a subscription lock overlay. */
export type SaasRoutableModuleKey =
  | 'peoples'
  | 'academic'
  | 'fees'
  | 'library'
  | 'hostel'
  | 'transport'
  | 'hrm'
  | 'accounts'
  | 'reports'
  | 'user_management'
  | 'membership'
  | 'settings'
  | 'application'
  | 'announcements'
  | 'content'
  | 'sports';

export function getModuleLabel(moduleKey: string): string {
  const top = SAAS_MODULE_CATALOG.find((m) => m.key === moduleKey)?.label;
  if (top) return top;
  if (ACADEMIC_SUBMODULE_KEYS.includes(moduleKey)) {
    return getAcademicSubmoduleLabel(moduleKey);
  }
  return moduleKey;
}

/**
 * Route is locked when route access is off (subscription upgrade required).
 * When saas_modules is absent, all routes remain accessible (legacy tenants).
 */
export function isModuleRouteLocked(
  modules: SaasModulesMap | null | undefined,
  moduleKey: string
): boolean {
  if (!modules || typeof modules !== 'object') return false;
  const flags = modules[moduleKey];
  if (!flags) return false;
  return flags.route_accessible === false;
}

export function isAcademicSubmoduleRouteLocked(
  modules: SaasModulesMap | null | undefined,
  subKey: string
): boolean {
  if (!modules || typeof modules !== 'object') return false;
  if (modules.academic?.route_accessible === false) return true;
  if (modules.academic?.show_in_menu === false) return true;
  const sub = modules[subKey];
  if (!sub) return false;
  return sub.route_accessible === false;
}

export function isAcademicSubmoduleMenuVisible(
  modules: SaasModulesMap | null | undefined,
  subKey: string
): boolean {
  if (!modules || typeof modules !== 'object') return true;
  if (modules.academic?.show_in_menu === false) return false;
  const sub = modules[subKey];
  if (!sub) return true;
  return sub.show_in_menu !== false;
}

export function isModuleRouteAccessible(
  modules: SaasModulesMap | null | undefined,
  moduleKey: string
): boolean {
  return !isModuleRouteLocked(modules, moduleKey);
}

/**
 * Whether a tenant route should show the SaaS lock overlay.
 */
export function isSaasPathRouteLocked(
  modules: SaasModulesMap | null | undefined,
  pathname: string
): boolean {
  const p = pathname.toLowerCase();

  const academicSub = resolveAcademicSubmoduleKeyFromPath(p);
  if (academicSub) {
    return isAcademicSubmoduleRouteLocked(modules, academicSub);
  }
  if (p.startsWith('/academic/')) {
    return isModuleRouteLocked(modules, 'academic');
  }

  if (p.startsWith('/student/student-fees')) {
    return isModuleRouteLocked(modules, 'fees');
  }
  if (p.startsWith('/student/')) {
    return isModuleRouteLocked(modules, 'peoples');
  }
  if (p.startsWith('/teacher/')) {
    return isModuleRouteLocked(modules, 'peoples');
  }
  if (
    p.startsWith('/parent/parent-') ||
    p.startsWith('/parent/guardians-') ||
    p.startsWith('/parent/homework')
  ) {
    return isModuleRouteLocked(modules, 'peoples');
  }
  if (p.startsWith('/administrative/')) {
    return isModuleRouteLocked(modules, 'peoples');
  }

  return false;
}

/**
 * Module key for lock page title (prefers academic sub-module when applicable).
 */
export function resolveSaasModuleKeyForLockPage(pathname: string): string | null {
  const academicSub = resolveAcademicSubmoduleKeyFromPath(pathname);
  if (academicSub) return academicSub;

  const p = pathname.toLowerCase();
  if (p.startsWith('/academic/')) return 'academic';
  if (p.startsWith('/student/student-fees')) return 'fees';
  if (p.startsWith('/student/')) return 'peoples';
  if (p.startsWith('/teacher/')) return 'peoples';
  if (
    p.startsWith('/parent/parent-') ||
    p.startsWith('/parent/guardians-') ||
    p.startsWith('/parent/homework')
  ) {
    return 'peoples';
  }
  if (p.startsWith('/administrative/')) return 'peoples';

  return null;
}

/** @deprecated Use isSaasPathRouteLocked */
export function resolveSaasModuleKeyFromPath(pathname: string): SaasRoutableModuleKey | null {
  const key = resolveSaasModuleKeyForLockPage(pathname);
  if (!key) return null;
  if (ACADEMIC_SUBMODULE_KEYS.includes(key)) return 'academic';
  return key as SaasRoutableModuleKey;
}
