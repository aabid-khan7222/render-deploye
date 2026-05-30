/**
 * Diagnostic: why a student may be missing from parent list.
 * Usage: node scripts/diag-parent-list.js [studentId]
 */
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_SCHOOL_HOST || 'localhost',
  port: Number(process.env.DB_SCHOOL_PORT || 5432),
  database: process.env.DB_SCHOOL_NAME || 'sxis_school_db',
  user: process.env.DB_SCHOOL_USER || 'postgres',
  password: process.env.DB_SCHOOL_PASS || process.env.DB_PASSWORD || '007222',
});

async function main() {
  const studentIdArg = process.argv[2] ? Number(process.argv[2]) : null;
  const q = async (sql, p = []) => (await pool.query(sql, p)).rows;

  const recent = studentIdArg
    ? await q(
        `SELECT s.id, s.admission_number, s.status, s.created_at,
                u.first_name || ' ' || u.last_name AS student_name
         FROM students s
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.id = $1`,
        [studentIdArg]
      )
    : await q(
        `SELECT s.id, s.admission_number, s.status, s.created_at,
                u.first_name || ' ' || u.last_name AS student_name
         FROM students s
         LEFT JOIN users u ON u.id = s.user_id
         ORDER BY s.id DESC LIMIT 8`
      );

  console.log('=== Students ===');
  console.log(JSON.stringify(recent, null, 2));

  for (const st of recent) {
    const links = await q(
      `SELECT sgl.id, sgl.relation, sgl.is_primary_contact,
              g.id AS guardian_id, g.user_id, g.is_active,
              u.first_name, u.last_name, u.email, u.role_id, ur.role_name
       FROM student_guardian_links sgl
       JOIN guardians g ON g.id = sgl.guardian_id
       JOIN users u ON u.id = g.user_id
       LEFT JOIN user_roles ur ON ur.id = u.role_id
       WHERE sgl.student_id = $1`,
      [st.id]
    );
    const enr = await q(
      `SELECT l.id, l.to_academic_year_id, l.to_class_id, l.to_section_id, l.event_date
       FROM student_lifecycle_ledger l
       WHERE l.student_id = $1
       ORDER BY l.event_date DESC NULLS LAST, l.id DESC LIMIT 3`,
      [st.id]
    );
    const parentLegacy = await q(
      `SELECT father_name, mother_name, father_email, mother_email
       FROM parents WHERE student_id = $1 ORDER BY id DESC LIMIT 1`,
      [st.id]
    ).catch(() => []);

    console.log(`\n--- Student ${st.id} (${st.student_name}) status=${st.status} ---`);
    console.log('Guardian links:', JSON.stringify(links, null, 2));
    console.log('Enrollment:', JSON.stringify(enr, null, 2));
    console.log('Legacy parents row:', JSON.stringify(parentLegacy, null, 2));

    const ayRows = await q(`SELECT id, year_name, is_current FROM academic_years ORDER BY id DESC LIMIT 5`);
    console.log('Academic years:', JSON.stringify(ayRows, null, 2));

    for (const ay of ayRows.filter((a) => a.is_current).slice(0, 1)) {
      const inParentList = await q(
        `SELECT s.id AS student_id,
                father_u.first_name AS father_first,
                mother_u.first_name AS mother_first
         FROM students s
         LEFT JOIN LATERAL (
           SELECT l.to_academic_year_id AS academic_year_id
           FROM student_lifecycle_ledger l
           WHERE l.student_id = s.id AND l.to_academic_year_id = $2
           ORDER BY l.event_date DESC NULLS LAST, l.id DESC LIMIT 1
         ) enr ON true
         LEFT JOIN LATERAL (
           SELECT u.first_name
           FROM student_guardian_links sgl
           INNER JOIN guardians g ON g.id = sgl.guardian_id AND COALESCE(g.is_active, true) = true
           INNER JOIN users u ON u.id = g.user_id
           WHERE sgl.student_id = s.id
             AND LOWER(BTRIM(COALESCE(sgl.relation::text, ''))) IN ('father', 'dad', 'papa', 'abbu')
           LIMIT 1
         ) father_u ON true
         LEFT JOIN LATERAL (
           SELECT u.first_name
           FROM student_guardian_links sgl
           INNER JOIN guardians g ON g.id = sgl.guardian_id AND COALESCE(g.is_active, true) = true
           INNER JOIN users u ON u.id = g.user_id
           WHERE sgl.student_id = s.id
             AND LOWER(BTRIM(COALESCE(sgl.relation::text, ''))) IN ('mother', 'mom', 'mummy', 'ammi')
           LIMIT 1
         ) mother_u ON true
         WHERE s.id = $1 AND s.status = 'Active'
           AND EXISTS (SELECT 1 FROM student_guardian_links sgl2 WHERE sgl2.student_id = s.id)
           AND enr.academic_year_id = $2`,
        [st.id, ay.id]
      );
      console.log(`Parent list match (year ${ay.id} ${ay.year_name}):`, JSON.stringify(inParentList, null, 2));
    }
  }

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
