/**
 * Academic sub-modules for granular SaaS plan / school overrides.
 * Keep in sync with client/src/core/utils/saasAcademicSubmodules.ts
 */
const ACADEMIC_SUBMODULE_CATALOG = [
  {
    key: 'academic_years',
    label: 'Academic Years',
    sidebarLabel: 'Academic Years',
    pathPrefixes: ['/academic/academic-years'],
  },
  {
    key: 'academic_classes',
    label: 'Classes',
    sidebarLabel: 'Classes',
    pathPrefixes: [
      '/academic/class-room',
      '/academic/class-section',
      '/academic/classes',
      '/academic/class-sections',
    ],
  },
  {
    key: 'academic_subjects',
    label: 'Subjects',
    sidebarLabel: 'Subjects',
    pathPrefixes: [
      '/academic/subjects',
      '/academic/class-subject',
      '/academic/curriculum-mapping',
    ],
  },
  {
    key: 'academic_timetable',
    label: 'Timetable',
    sidebarLabel: 'Timetable',
    pathPrefixes: [
      '/academic/timetable',
      '/academic/class-time-table',
      '/academic/section-routine',
      '/academic/class-routine',
    ],
  },
  {
    key: 'academic_homework',
    label: 'Home Work',
    sidebarLabel: 'Home Work',
    pathPrefixes: ['/academic/class-home-work'],
  },
  {
    key: 'academic_examinations',
    label: 'Examinations',
    sidebarLabel: 'Examinations',
    pathPrefixes: [
      '/academic/exam',
      '/academic/exam-types',
      '/academic/exam-schedule',
      '/academic/exam-result',
      '/academic/exam-top-performers',
      '/academic/exam-timetable',
      '/academic/grade',
    ],
  },
  {
    key: 'academic_enquiries',
    label: 'Enquiries',
    sidebarLabel: 'Enquiries',
    pathPrefixes: ['/enquiries'],
  },
  {
    key: 'academic_reasons',
    label: 'Reasons',
    sidebarLabel: 'Reasons',
    pathPrefixes: ['/academic/academic-reason'],
  },
];

const ACADEMIC_SUBMODULE_KEYS = ACADEMIC_SUBMODULE_CATALOG.map((m) => m.key);

const ACADEMIC_SIDEBAR_LABEL_TO_KEY = Object.fromEntries(
  ACADEMIC_SUBMODULE_CATALOG.map((m) => [m.sidebarLabel, m.key])
);

function resolveAcademicSubmoduleKeyFromPath(pathname) {
  const p = String(pathname || '').toLowerCase();
  for (const sub of ACADEMIC_SUBMODULE_CATALOG) {
    for (const prefix of sub.pathPrefixes) {
      const pref = prefix.toLowerCase();
      if (p === pref || p.startsWith(`${pref}/`)) {
        return sub.key;
      }
    }
  }
  return null;
}

module.exports = {
  ACADEMIC_SUBMODULE_CATALOG,
  ACADEMIC_SUBMODULE_KEYS,
  ACADEMIC_SIDEBAR_LABEL_TO_KEY,
  resolveAcademicSubmoduleKeyFromPath,
};
