import type { SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { ALL_SAAS_MODULE_KEYS } from '../../core/utils/saasModuleKeys';
import { ACADEMIC_SUBMODULE_KEYS } from '../../core/utils/saasAcademicSubmodules';

/** When menu is off, route access is forced off. Route toggle only applies when menu is on. */
export function patchSaasModuleFlags(
  prev: SaasModulesMap,
  key: string,
  field: 'show_in_menu' | 'route_accessible',
  value: boolean
): SaasModulesMap {
  const cur = prev[key] || { show_in_menu: true, route_accessible: true };
  let next: SaasModulesMap;

  if (field === 'show_in_menu') {
    next = {
      ...prev,
      [key]: {
        show_in_menu: value,
        route_accessible: value ? cur.route_accessible : false,
      },
    };
  } else if (!cur.show_in_menu) {
    return prev;
  } else {
    next = {
      ...prev,
      [key]: { ...cur, route_accessible: value },
    };
  }

  if (key === 'academic') {
    if (field === 'show_in_menu' && !value) {
      for (const subKey of ACADEMIC_SUBMODULE_KEYS) {
        next[subKey] = { show_in_menu: false, route_accessible: false };
      }
    }
    if (field === 'route_accessible' && !value) {
      for (const subKey of ACADEMIC_SUBMODULE_KEYS) {
        const subCur = next[subKey] || { show_in_menu: true, route_accessible: true };
        next[subKey] = { ...subCur, route_accessible: false };
      }
    }
  }

  return next;
}

export function normalizeSaasModulesMap(modules: SaasModulesMap): SaasModulesMap {
  const out: SaasModulesMap = { ...modules };
  for (const key of Object.keys(out)) {
    const row = out[key];
    if (!row) continue;
    if (!row.show_in_menu) {
      out[key] = { ...row, route_accessible: false };
    }
  }
  return out;
}

/** All module keys to persist (top-level + academic sub-modules). */
export function buildSaasModulePayloadRows(modules: SaasModulesMap) {
  return ALL_SAAS_MODULE_KEYS.map((key) => ({
    module_key: key,
    show_in_menu: modules[key]?.show_in_menu !== false,
    route_accessible: modules[key]?.route_accessible !== false,
  }));
}
