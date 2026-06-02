import { useCallback, useEffect, useMemo, useState } from "react";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useSubjects } from "../../../core/hooks/useSubjects";
import { apiService } from "../../../core/services/apiService";
import { printData } from "../../../core/utils/exportUtils";
import Swal from "sweetalert2";
import { Link } from "react-router-dom";
import type { TableData } from "../../../core/data/interface";

const SubjectList = () => {
  const routes = all_routes;
  const { subjects, loading, error, refetch } = useSubjects(null);

  const [selectedSubject, setSelectedSubject] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [form, setForm] = useState({
    subject_name: "",
    subject_code: "",
    subject_type: "Theory",
    description: "",
    is_active: true,
  });

  useEffect(() => {
    const hasOpenModal = isAddModalOpen || isEditModalOpen;
    if (hasOpenModal) {
      document.body.classList.add("modal-open");
    } else {
      document.body.classList.remove("modal-open");
    }

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, [isAddModalOpen, isEditModalOpen]);

  const resetForm = useCallback(() => {
    setForm({
      subject_name: "",
      subject_code: "",
      subject_type: "Theory",
      description: "",
      is_active: true,
    });
  }, []);

  const openAddModal = useCallback(() => {
    setSelectedSubject(null);
    resetForm();
    setIsAddModalOpen(true);
  }, [resetForm]);

  const closeAddModal = useCallback(() => {
    if (isSaving) return;
    setIsAddModalOpen(false);
  }, [isSaving]);

  const openEditModal = useCallback((record: any) => {
    setSelectedSubject(record);
    setForm({
      subject_name: record.originalData?.subject_name || "",
      subject_code: record.originalData?.subject_code || "",
      subject_type: record.originalData?.subject_type || "Theory",
      description: record.originalData?.description || "",
      is_active: record.status === "Active",
    });
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    if (isSaving) return;
    setIsEditModalOpen(false);
    setSelectedSubject(null);
    resetForm();
  }, [isSaving, resetForm]);

  const data = useMemo(() => {
    return (subjects ?? []).map((s: any, index: number) => ({
      key: String(s.id ?? index),
      id: s.id,
      name: s.subject_name || "N/A",
      code: s.subject_code || "N/A",
      type: s.subject_type || "Theory",
      description: s.description || "N/A",
      status: s.is_active ? "Active" : "Inactive",
      originalData: s,
    }));
  }, [subjects]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      sorter: (a: TableData, b: TableData) => Number(a.id) - Number(b.id),
    },
    {
      title: "Subject Name",
      dataIndex: "name",
      sorter: (a: TableData, b: TableData) => String(a.name).localeCompare(String(b.name)),
      render: (text: string) => <span className="fw-bold text-dark">{text}</span>
    },
    {
      title: "Code",
      dataIndex: "code",
      sorter: (a: TableData, b: TableData) => String(a.code).localeCompare(String(b.code)),
      render: (text: string) => <span className="badge badge-soft-info">{text}</span>
    },
    {
      title: "Type",
      dataIndex: "type",
      sorter: (a: TableData, b: TableData) => String(a.type).localeCompare(String(b.type)),
      render: (text: string) => (
        <span className={`badge ${text === "Theory" ? "bg-info" : "bg-secondary"}`}>
          {text}
        </span>
      )
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <span className={`badge ${text === "Active" ? "badge-soft-success" : "badge-soft-danger"} d-inline-flex align-items-center`}>
          <i className="ti ti-circle-filled fs-5 me-1"></i>
          {text}
        </span>
      ),
      sorter: (a: TableData, b: TableData) => String(a.status).localeCompare(String(b.status)),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => openEditModal(record)}
          >
            <i className="ti ti-edit-circle me-1" />
            Edit
          </button>
          <button
            type="button"
            className="btn btn-outline-danger btn-sm"
            onClick={() => handleDelete(record.id)}
          >
            <i className="ti ti-trash-x me-1" />
            Delete
          </button>
          </div>
      ),
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject_name.trim()) return;
    setIsSaving(true);
    try {
      await apiService.createSubject({
        subject_name: form.subject_name.trim(),
        subject_code: form.subject_code.trim().toUpperCase() || null,
        subject_type: form.subject_type,
        description: form.description.trim() || null,
        is_active: form.is_active,
      });
      await refetch();
      closeAddModal();
      resetForm();
      Swal.fire("Success", "Subject created successfully", "success");
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to create subject", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject?.id || !form.subject_name.trim()) return;
    setIsSaving(true);
    try {
      await apiService.updateSubject(selectedSubject.id, {
        subject_name: form.subject_name.trim(),
        subject_code: form.subject_code.trim().toUpperCase() || null,
        subject_type: form.subject_type,
        description: form.description.trim() || null,
        is_active: form.is_active,
      });
      await refetch();
      closeEditModal();
      Swal.fire("Success", "Subject updated successfully", "success");
    } catch (err: any) {
      Swal.fire("Error", err.message || "Failed to update subject", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: number) => {
    Swal.fire({
      title: "Are you sure?",
      text: "You won't be able to revert this!",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#3085d6",
      cancelButtonColor: "#d33",
      confirmButtonText: "Yes, delete it!"
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await apiService.deleteSubject(id);
          await refetch();
          Swal.fire("Deleted!", "Subject has been deleted.", "success");
        } catch (err: any) {
          Swal.fire("Error", err.message || "Failed to delete subject", "error");
        }
      }
    });
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Subject List</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item active">Subjects</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption
              onRefresh={() => refetch()}
              onPrint={() => printData("Subject List", [{ title: "Name", dataKey: "name" }, { title: "Code", dataKey: "code" }, { title: "Type", dataKey: "type" }], data)}
            />
            <div className="mb-2">
              <button type="button" className="btn btn-primary d-flex align-items-center" onClick={openAddModal}>
                <i className="ti ti-square-rounded-plus-filled me-2"></i>
                Add Subject
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body p-0 py-3">
            {loading ? (
              <div className="text-center p-5"><div className="spinner-border text-primary" role="status"></div></div>
            ) : error ? (
              <div className="alert alert-danger m-3">{error}</div>
            ) : (
              <Table columns={columns} dataSource={data} Selection={false} />
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      <div className={`modal fade ${isAddModalOpen ? "show d-block" : ""}`} id="add_subject" aria-hidden={!isAddModalOpen} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Subject</h4>
              <button type="button" className="btn-close" onClick={closeAddModal}></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Subject Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" value={form.subject_name} onChange={e => setForm({ ...form, subject_name: e.target.value })} required />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Subject Code</label>
                    <input type="text" className="form-control" value={form.subject_code} onChange={e => setForm({ ...form, subject_code: e.target.value })} placeholder="e.g. MATH101" />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Subject Type <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.subject_type} onChange={e => setForm({ ...form, subject_type: e.target.value })} required>
                      <option value="Theory">Theory</option>
                      <option value="Practical">Practical</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}></textarea>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Active Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeAddModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Saving..." : "Create Subject"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <div className={`modal fade ${isEditModalOpen ? "show d-block" : ""}`} id="edit_subject" aria-hidden={!isEditModalOpen} role="dialog">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Subject</h4>
              <button type="button" className="btn-close" onClick={closeEditModal}></button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Subject Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" value={form.subject_name} onChange={e => setForm({ ...form, subject_name: e.target.value })} required />
                </div>
                <div className="row">
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Subject Code</label>
                    <input type="text" className="form-control" value={form.subject_code} onChange={e => setForm({ ...form, subject_code: e.target.value })} />
                  </div>
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Subject Type <span className="text-danger">*</span></label>
                    <select className="form-select" value={form.subject_type} onChange={e => setForm({ ...form, subject_type: e.target.value })} required>
                      <option value="Theory">Theory</option>
                      <option value="Practical">Practical</option>
                    </select>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3}></textarea>
                </div>
                <div className="d-flex align-items-center justify-content-between">
                  <h5>Active Status</h5>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-light" onClick={closeEditModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? "Updating..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {isAddModalOpen || isEditModalOpen ? <div className="modal-backdrop fade show"></div> : null}
    </div>
  );
};

export default SubjectList;
