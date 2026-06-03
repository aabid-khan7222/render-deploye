/**
 * Keeps student_lifecycle_ledger enrollment corrections consistent with
 * composite-FK dependents (homework, attendance) when class/year changes on edit.
 *
 * Promotion/rejoin flows INSERT new ledger rows; edit-student updates the latest row.
 */

/**
 * Remove rows that pin the old (lifecycle_id, student_id, academic_year_id, class_id)
 * composite key so the ledger enrollment anchor can be updated safely.
 */
async function clearCompositeLifecycleDependents(client, {
  lifecycleId,
  studentId,
  academicYearId,
  classId,
}) {
  const lid = Number(lifecycleId);
  const sid = Number(studentId);
  const ay = Number(academicYearId);
  const cid = Number(classId);
  if (!Number.isFinite(lid) || !Number.isFinite(sid) || !Number.isFinite(ay) || !Number.isFinite(cid)) {
    return;
  }

  await client.query(
    `DELETE FROM submission_attachments sa
     USING homework_submissions hs
     WHERE sa.submission_id = hs.id
       AND hs.student_id = $1
       AND hs.student_lifecycle_id = $2
       AND hs.academic_year_id = $3
       AND hs.class_id = $4`,
    [sid, lid, ay, cid]
  );

  await client.query(
    `DELETE FROM homework_submissions
     WHERE student_id = $1
       AND student_lifecycle_id = $2
       AND academic_year_id = $3
       AND class_id = $4`,
    [sid, lid, ay, cid]
  );

  await client.query(
    `DELETE FROM homework_recipients
     WHERE student_id = $1
       AND student_lifecycle_id = $2
       AND academic_year_id = $3
       AND class_id = $4`,
    [sid, lid, ay, cid]
  );

  await client.query(
    `DELETE FROM student_attendance
     WHERE student_id = $1
       AND lifecycle_id = $2
       AND academic_year_id = $3
       AND class_id = $4`,
    [sid, lid, ay, cid]
  );
}

/**
 * Detach transport rows from the lifecycle year anchor before changing to_academic_year_id.
 * (FK is year-scoped; NULL lifecycle_id skips the constraint.)
 */
async function detachTransportLifecycleYearAnchor(client, {
  lifecycleId,
  studentId,
  academicYearId,
}) {
  await client.query(
    `UPDATE transport_allocations
     SET student_lifecycle_id = NULL,
         updated_at = NOW()
     WHERE student_id = $1
       AND student_lifecycle_id = $2
       AND academic_year_id = $3`,
    [studentId, lifecycleId, academicYearId]
  );
}

/**
 * After ledger year is updated, align library rows that reference the lifecycle id.
 */
async function repointLibraryLifecycleYear(client, {
  lifecycleId,
  studentId,
  newAcademicYearId,
}) {
  await client.query(
    `UPDATE library_book_issues
     SET academic_year_id = $1, updated_at = NOW()
     WHERE student_id = $2 AND student_lifecycle_id = $3`,
    [newAcademicYearId, studentId, lifecycleId]
  );
  await client.query(
    `UPDATE library_book_reservations
     SET academic_year_id = $1, updated_at = NOW()
     WHERE student_id = $2 AND student_lifecycle_id = $3`,
    [newAcademicYearId, studentId, lifecycleId]
  );
}

/**
 * Apply enrollment correction on the latest lifecycle ledger row (edit-student flow).
 *
 * @returns {{ updated: boolean, lifecycleId: number|null, warnings: string[] }}
 */
async function syncLatestLifecycleEnrollment(client, studentId, {
  academicYearId,
  classId,
  sectionId,
}) {
  const warnings = [];
  const sid = Number(studentId);
  const newYear = Number(academicYearId);
  const newClass = Number(classId);
  const newSection =
    sectionId === null || sectionId === undefined || sectionId === ''
      ? null
      : Number(sectionId);

  if (!Number.isFinite(sid) || !Number.isFinite(newYear) || !Number.isFinite(newClass)) {
    return { updated: false, lifecycleId: null, warnings };
  }

  const curRes = await client.query(
    `SELECT id, to_academic_year_id, to_class_id, to_section_id
     FROM student_lifecycle_ledger
     WHERE student_id = $1
     ORDER BY event_date DESC NULLS LAST, id DESC
     LIMIT 1`,
    [sid]
  );

  if (curRes.rows.length === 0) {
    await client.query(
      `INSERT INTO student_lifecycle_ledger (
         student_id, event_type, to_academic_year_id, to_class_id, to_section_id, event_date
       ) VALUES ($1, 'ADMISSION', $2, $3, $4, CURRENT_DATE)`,
      [sid, newYear, newClass, Number.isFinite(newSection) ? newSection : null]
    );
    const ins = await client.query(
      `SELECT id FROM student_lifecycle_ledger
       WHERE student_id = $1
       ORDER BY id DESC LIMIT 1`,
      [sid]
    );
    return { updated: true, lifecycleId: ins.rows[0]?.id ?? null, warnings };
  }

  const row = curRes.rows[0];
  const lifecycleId = Number(row.id);
  const oldYear = Number(row.to_academic_year_id);
  const oldClass = Number(row.to_class_id);
  const oldSection = row.to_section_id != null ? Number(row.to_section_id) : null;

  const yearChanged = oldYear !== newYear;
  const classChanged = oldClass !== newClass;
  const sectionChanged = (oldSection ?? null) !== (Number.isFinite(newSection) ? newSection : null);

  if (!yearChanged && !classChanged && !sectionChanged) {
    return { updated: false, lifecycleId, warnings };
  }

  if (yearChanged || classChanged) {
    await clearCompositeLifecycleDependents(client, {
      lifecycleId,
      studentId: sid,
      academicYearId: oldYear,
      classId: oldClass,
    });
    if (yearChanged) {
      await detachTransportLifecycleYearAnchor(client, {
        lifecycleId,
        studentId: sid,
        academicYearId: oldYear,
      });
      warnings.push(
        'Class homework and attendance for the previous enrollment were reset because the academic year changed. Re-assign transport if needed.'
      );
    } else {
      warnings.push(
        'Homework and attendance records for the previous class were cleared because the class changed.'
      );
    }
  }

  await client.query(
    `UPDATE student_lifecycle_ledger
     SET to_academic_year_id = $1,
         to_class_id = $2,
         to_section_id = $3,
         updated_at = NOW()
     WHERE id = $4`,
    [newYear, newClass, Number.isFinite(newSection) ? newSection : null, lifecycleId]
  );

  if (yearChanged) {
    await repointLibraryLifecycleYear(client, {
      lifecycleId,
      studentId: sid,
      newAcademicYearId: newYear,
    });
  }

  return { updated: true, lifecycleId, warnings };
}

module.exports = {
  syncLatestLifecycleEnrollment,
  clearCompositeLifecycleDependents,
};
