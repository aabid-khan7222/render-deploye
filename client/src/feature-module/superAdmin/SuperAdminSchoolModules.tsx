import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { superAdminApiService } from '../../core/services/superAdminApiService';
import {
  selectSuperAdminAuthChecked,
  selectSuperAdminIsAuthenticated,
} from '../../core/data/redux/superAdminAuthSlice';
import { type SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { all_routes } from '../router/all_routes';
import { buildSaasModulePayloadRows } from './saasModuleUi';
import SaasModuleMatrixTable from './SaasModuleMatrixTable';
import { superAdminToast } from './superAdminToast';

const SuperAdminSchoolModules = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const schoolId = Number(id);
  const authChecked = useSelector(selectSuperAdminAuthChecked);
  const isAuthenticated = useSelector(selectSuperAdminIsAuthenticated);

  const [schoolName, setSchoolName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modules, setModules] = useState<SaasModulesMap | null>(null);

  useEffect(() => {
    if (!authChecked || !isAuthenticated || !schoolId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [modRes, schRes] = await Promise.all([
          superAdminApiService.getSchoolModules(schoolId),
          superAdminApiService.getSchoolById(schoolId),
        ]);
        if (cancelled) return;
        if (schRes.status === 'SUCCESS' && schRes.data) {
          setSchoolName(String((schRes.data as { school_name?: string }).school_name || ''));
        }
        if (modRes.status === 'SUCCESS' && modRes.data && (modRes.data as { effective?: SaasModulesMap }).effective) {
          setModules({ ...(modRes.data as { effective: SaasModulesMap }).effective });
        } else {
          setError(modRes.message || 'Failed to load modules');
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [schoolId, authChecked, isAuthenticated]);

  const updateModules = (next: SaasModulesMap) => {
    setModules(next);
  };

  const handleSave = async () => {
    if (!modules) return;
    setSaving(true);
    setError(null);
    try {
      const overrides = buildSaasModulePayloadRows(modules);
      const res = await superAdminApiService.putSchoolModuleOverrides(schoolId, overrides);
      if (res.status === 'SUCCESS') {
        superAdminToast.success('Module overrides saved successfully');
      } else {
        superAdminToast.error(res.message || 'Save failed');
      }
    } catch (e: unknown) {
      superAdminToast.error(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h3 className="mb-0 text-body">School modules</h3>
          <div className="small text-muted">
            {schoolName ? <span>{schoolName}</span> : <span>School #{schoolId}</span>}
            <span className="mx-1">·</span>
            <span>Overrides replace plan defaults for this tenant only.</span>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(`${all_routes.superAdminSchoolPermissions}?school=${schoolId}`)}
          >
            Permissions view
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(`/super-admin/schools/${schoolId}`)}>
            School view
          </button>
          <button type="button" className="btn btn-primary" disabled={saving || !modules} onClick={handleSave}>
            {saving ? 'Saving…' : 'Save overrides'}
          </button>
        </div>
      </div>

      {loading && <p className="text-body-secondary">Loading…</p>}
      {error && <div className="alert alert-danger">{error}</div>}

      {!loading && modules && (
        <div className="table-responsive border border-secondary rounded">
          <SaasModuleMatrixTable modules={modules} mode="edit" onChange={updateModules} />
        </div>
      )}
    </div>
  );
};

export default SuperAdminSchoolModules;
