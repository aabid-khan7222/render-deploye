import { Fragment, useState } from 'react';
import { SAAS_MODULE_CATALOG, type SaasModulesMap } from '../../core/utils/saasModuleKeys';
import { ACADEMIC_SUBMODULE_CATALOG } from '../../core/utils/saasAcademicSubmodules';
import { patchSaasModuleFlags } from './saasModuleUi';

type Mode = 'edit' | 'readonly';

type Props = {
  modules: SaasModulesMap;
  mode: Mode;
  onChange?: (next: SaasModulesMap) => void;
};

const SaasModuleMatrixTable = ({ modules, mode, onChange }: Props) => {
  const [academicOpen, setAcademicOpen] = useState(true);
  const isEdit = mode === 'edit';

  const updateFlag = (key: string, field: 'show_in_menu' | 'route_accessible', value: boolean) => {
    if (!isEdit || !onChange) return;
    onChange(patchSaasModuleFlags(modules, key, field, value));
  };

  const academicParentOn = !!modules.academic?.show_in_menu;

  return (
    <table className="table table-sm align-middle mb-0">
      <thead className={mode === 'readonly' ? 'table-light' : undefined}>
        <tr>
          <th className={mode === 'readonly' ? 'ps-2' : undefined}>Module</th>
          <th className={mode === 'readonly' ? 'text-center' : undefined}>
            {mode === 'readonly' ? 'Menu' : 'Menu'}
          </th>
          <th className={mode === 'readonly' ? 'text-center pe-2' : undefined}>
            {mode === 'readonly' ? 'Access' : 'Accessible'}
          </th>
        </tr>
      </thead>
      <tbody>
        {SAAS_MODULE_CATALOG.map(({ key, label }) => {
          if (key === 'academic') {
            const menuOn = !!modules.academic?.show_in_menu;
            const accOn = modules.academic?.route_accessible !== false && menuOn;
            return (
              <Fragment key={key}>
                <tr key={key}>
                  <td className={mode === 'readonly' ? 'ps-2' : undefined}>
                    <div className="d-flex align-items-center gap-2">
                      {isEdit && (
                        <button
                          type="button"
                          className="btn btn-sm btn-link p-0 text-decoration-none"
                          aria-expanded={academicOpen}
                          onClick={() => setAcademicOpen((o) => !o)}
                          title={academicOpen ? 'Collapse academic options' : 'Expand academic options'}
                        >
                          <i className={`ti ${academicOpen ? 'ti-chevron-down' : 'ti-chevron-right'}`} />
                        </button>
                      )}
                      <span className="fw-medium">{label}</span>
                    </div>
                    {mode === 'readonly' && (
                      <code className="d-block text-muted" style={{ fontSize: '0.7rem' }}>
                        {key}
                      </code>
                    )}
                  </td>
                  <td className={mode === 'readonly' ? 'text-center' : undefined}>
                    {isEdit ? (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={menuOn}
                        onChange={(e) => updateFlag(key, 'show_in_menu', e.target.checked)}
                      />
                    ) : (
                      <span
                        className={`sa-perm-dot ${menuOn ? 'bg-success' : 'bg-secondary'}`}
                        title={menuOn ? 'Visible in menu' : 'Hidden from menu'}
                      />
                    )}
                  </td>
                  <td className={mode === 'readonly' ? 'text-center pe-2' : undefined}>
                    {isEdit ? (
                      <input
                        type="checkbox"
                        className="form-check-input"
                        checked={accOn}
                        disabled={!menuOn}
                        title={menuOn ? undefined : 'Enable menu first'}
                        onChange={(e) => updateFlag(key, 'route_accessible', e.target.checked)}
                      />
                    ) : (
                      <span
                        className={`sa-perm-dot ${accOn ? 'bg-primary' : 'bg-secondary'}`}
                        title={accOn ? 'Route accessible' : 'Route locked (flag)'}
                      />
                    )}
                  </td>
                </tr>
                {(academicOpen || !isEdit) &&
                  ACADEMIC_SUBMODULE_CATALOG.map((sub) => {
                    const subMenuOn =
                      academicParentOn && modules[sub.key]?.show_in_menu !== false;
                    const subAccOn =
                      academicParentOn &&
                      modules.academic?.route_accessible !== false &&
                      modules[sub.key]?.route_accessible !== false;
                    return (
                      <tr key={sub.key} className="table-light">
                        <td className={mode === 'readonly' ? 'ps-4' : 'ps-4'}>
                          <span className="text-muted small">↳ {sub.label}</span>
                          {mode === 'readonly' && (
                            <code className="d-block text-muted" style={{ fontSize: '0.7rem' }}>
                              {sub.key}
                            </code>
                          )}
                        </td>
                        <td className={mode === 'readonly' ? 'text-center' : undefined}>
                          {isEdit ? (
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={subMenuOn}
                              disabled={!academicParentOn}
                              title={academicParentOn ? undefined : 'Enable Academic menu first'}
                              onChange={(e) => updateFlag(sub.key, 'show_in_menu', e.target.checked)}
                            />
                          ) : (
                            <span
                              className={`sa-perm-dot ${subMenuOn ? 'bg-success' : 'bg-secondary'}`}
                              title={subMenuOn ? 'Visible in menu' : 'Hidden from menu'}
                            />
                          )}
                        </td>
                        <td className={mode === 'readonly' ? 'text-center pe-2' : undefined}>
                          {isEdit ? (
                            <input
                              type="checkbox"
                              className="form-check-input"
                              checked={subAccOn}
                              disabled={!academicParentOn || !subMenuOn}
                              title={
                                !academicParentOn
                                  ? 'Enable Academic menu first'
                                  : subMenuOn
                                    ? undefined
                                    : 'Enable menu first'
                              }
                              onChange={(e) => updateFlag(sub.key, 'route_accessible', e.target.checked)}
                            />
                          ) : (
                            <span
                              className={`sa-perm-dot ${subAccOn ? 'bg-primary' : 'bg-secondary'}`}
                              title={subAccOn ? 'Route accessible' : 'Route locked (flag)'}
                            />
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </Fragment>
            );
          }

          const menuOn = !!modules[key]?.show_in_menu;
          const accOn = !!modules[key]?.route_accessible;
          return (
            <tr key={key}>
              <td className={mode === 'readonly' ? 'ps-2' : undefined}>
                <span className={mode === 'readonly' ? 'fw-medium' : undefined}>{label}</span>
                {mode === 'readonly' && (
                  <code className="d-block text-muted" style={{ fontSize: '0.7rem' }}>
                    {key}
                  </code>
                )}
              </td>
              <td className={mode === 'readonly' ? 'text-center' : undefined}>
                {isEdit ? (
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={menuOn}
                    onChange={(e) => updateFlag(key, 'show_in_menu', e.target.checked)}
                  />
                ) : (
                  <span
                    className={`sa-perm-dot ${menuOn ? 'bg-success' : 'bg-secondary'}`}
                    title={menuOn ? 'Visible in menu' : 'Hidden from menu'}
                  />
                )}
              </td>
              <td className={mode === 'readonly' ? 'text-center pe-2' : undefined}>
                {isEdit ? (
                  <input
                    type="checkbox"
                    className="form-check-input"
                    checked={accOn}
                    disabled={!menuOn}
                    title={menuOn ? undefined : 'Enable menu first'}
                    onChange={(e) => updateFlag(key, 'route_accessible', e.target.checked)}
                  />
                ) : (
                  <span
                    className={`sa-perm-dot ${accOn ? 'bg-primary' : 'bg-secondary'}`}
                    title={accOn ? 'Route accessible' : 'Route locked (flag)'}
                  />
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default SaasModuleMatrixTable;
