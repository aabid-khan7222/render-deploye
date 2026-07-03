-- Granular academic sub-module keys for SaaS plans (master_db).
-- Safe to run after 20260514120000_saas_plans_enquiries.sql

INSERT INTO public.saas_plan_modules (plan_id, module_key, show_in_menu, route_accessible)
SELECT p.id, k, TRUE, TRUE
FROM public.saas_plans p
CROSS JOIN (
  VALUES
    ('academic_years'),
    ('academic_classes'),
    ('academic_subjects'),
    ('academic_timetable'),
    ('academic_homework'),
    ('academic_examinations'),
    ('academic_enquiries'),
    ('academic_reasons')
) AS v(k)
ON CONFLICT (plan_id, module_key) DO NOTHING;
