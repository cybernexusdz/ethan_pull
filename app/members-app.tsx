'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AtSign,
  Building2,
  LogOut,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/client'
import type { Database } from '@/lib/database.types'

type Member = Database['public']['Tables']['members']['Row'] & {
  department: { name: string } | null
}
type Department = Database['public']['Tables']['departments']['Row']
type MemberInput = {
  name: string
  telegram_id: string | null
  telegram_username: string | null
  department_id: string | null
}

type MembersAppProps = {
  email: string
  initialMembers: Member[]
  initialDepartments: Department[]
  loadError: string | null
}

type MemberFormProps = {
  member: Member | null
  departments: Department[]
  onSave: (input: MemberInput) => Promise<void>
  onClose: () => void
}

type DepartmentFormProps = {
  department: Department | null
  onSave: (input: Pick<Department, 'name' | 'telegram_title_ar'>) => Promise<void>
  onClose: () => void
}

export function MembersApp({
  email,
  initialMembers,
  initialDepartments,
  loadError,
}: MembersAppProps) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [departments, setDepartments] = useState(initialDepartments)
  const [activeView, setActiveView] = useState<'members' | 'departments'>('members')
  const [search, setSearch] = useState('')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [actionError, setActionError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => setMembers(initialMembers), [initialMembers])
  useEffect(() => setDepartments(initialDepartments), [initialDepartments])

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return members

    return members.filter((member) =>
      [
        member.name,
        member.telegram_id ?? '',
        member.telegram_username ?? '',
        member.department?.name ?? '',
      ].some((value) => value.toLowerCase().includes(query)),
    )
  }, [members, search])

  async function saveMember(input: MemberInput) {
    const supabase = createClient()
    const result = editingMember
      ? await supabase.from('members').update(input).eq('id', editingMember.id)
      : await supabase.from('members').insert(input)

    if (result.error) throw new Error(result.error.message)

    setMemberDialogOpen(false)
    setEditingMember(null)
    setActionError('')
    router.refresh()
  }

  async function saveDepartment(input: Pick<Department, 'name' | 'telegram_title_ar'>) {
    const supabase = createClient()
    const result = editingDepartment
      ? await supabase.from('departments').update(input).eq('id', editingDepartment.id)
      : await supabase.from('departments').insert(input)

    if (result.error) throw new Error(result.error.message)

    setDepartmentDialogOpen(false)
    setEditingDepartment(null)
    setActionError('')
    router.refresh()
  }

  async function deleteMember(member: Member) {
    if (!window.confirm(`Remove ${member.name} from the directory?`)) return

    setActionError('')
    try {
      const { error } = await createClient().from('members').delete().eq('id', member.id)
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to remove member.')
    }
  }

  async function deleteDepartment(department: Department) {
    const assignedCount = members.filter((member) => member.department_id === department.id).length
    const message = assignedCount
      ? `Remove ${department.name}? ${assignedCount} member${assignedCount === 1 ? '' : 's'} will become unassigned.`
      : `Remove ${department.name}?`
    if (!window.confirm(message)) return

    setActionError('')
    try {
      const { error } = await createClient().from('departments').delete().eq('id', department.id)
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to remove department.')
    }
  }

  async function signOut() {
    setSigningOut(true)
    setActionError('')
    try {
      const { error } = await createClient().auth.signOut()
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to sign out.')
      setSigningOut(false)
    }
  }

  function openMemberForm(member: Member | null = null) {
    setEditingMember(member)
    setMemberDialogOpen(true)
  }

  function openDepartmentForm(department: Department | null = null) {
    setEditingDepartment(department)
    setDepartmentDialogOpen(true)
  }

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="sidebar-brand" href="/" aria-label="Ethan Pull home">
          <span className="brand-mark"><Users size={19} strokeWidth={2.2} /></span>
          <span>Ethan Pull</span>
        </a>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${activeView === 'members' ? 'active' : ''}`}
            onClick={() => { setActiveView('members'); setSearch('') }}
          >
            <Users size={18} />
            <span>Members</span>
            <span className="nav-count">{members.length}</span>
          </button>
          <button
            className={`nav-item ${activeView === 'departments' ? 'active' : ''}`}
            onClick={() => { setActiveView('departments'); setSearch('') }}
          >
            <Building2 size={18} />
            <span>Departments</span>
            <span className="nav-count">{departments.length}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="security-note">
            <ShieldCheck size={17} />
            <span>Private workspace<br /><small>Only signed-in users can access this directory.</small></span>
          </div>
          <div className="account-row">
            <div className="account-avatar">{email.slice(0, 1).toUpperCase() || 'U'}</div>
            <div className="account-info"><strong>{email || 'Workspace user'}</strong><small>Administrator</small></div>
            <button
              className="icon-button signout-button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark"><Users size={18} /></span>
            <span>Ethan Pull</span>
          </div>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeView === 'members' ? 'Members' : 'Departments'}</strong></div>
          <div className="topbar-right">
            <span className="secure-pill"><span /> Secure workspace</span>
            <button className="mobile-signout icon-button" onClick={signOut} disabled={signingOut} aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <div className="page-content">
          <nav className="mobile-tabs" aria-label="Workspace sections">
            <button className={activeView === 'members' ? 'active' : ''} onClick={() => { setActiveView('members'); setSearch('') }}>
              <Users size={16} /> Members <span>{members.length}</span>
            </button>
            <button className={activeView === 'departments' ? 'active' : ''} onClick={() => { setActiveView('departments'); setSearch('') }}>
              <Building2 size={16} /> Departments <span>{departments.length}</span>
            </button>
          </nav>

          <section className="page-heading">
            <div>
              <div className="eyebrow">{activeView === 'members' ? 'YOUR PEOPLE' : 'YOUR ORGANIZATION'}</div>
              <h1>{activeView === 'members' ? 'Members' : 'Departments'}</h1>
              <p>{activeView === 'members' ? 'Keep your people and their Telegram details in one place.' : 'Group members into the teams that make up your organization.'}</p>
            </div>
            <button
              className="primary-button"
              onClick={() => activeView === 'members' ? openMemberForm() : openDepartmentForm()}
            >
              <Plus size={18} />
              {activeView === 'members' ? 'Add member' : 'Add department'}
            </button>
          </section>

          {loadError && (
            <div className="notice notice-error" role="alert">
              <strong>Could not load your directory.</strong>
              <span>{loadError}</span>
              <span>Run <code>supabase/schema.sql</code> in your Supabase SQL Editor, then refresh.</span>
            </div>
          )}
          {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}

          <section className="stats-grid" aria-label="Directory overview">
            <article className="stat-card">
              <div className="stat-icon stat-icon-blue"><Users size={18} /></div>
              <span>Total members</span>
              <strong>{members.length}</strong>
              <small>in your directory</small>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-green"><Building2 size={18} /></div>
              <span>Departments</span>
              <strong>{departments.length}</strong>
              <small>in your organization</small>
            </article>
            <article className="stat-card">
              <div className="stat-icon stat-icon-amber"><Users size={18} /></div>
              <span>Unassigned</span>
              <strong>{members.filter((member) => !member.department_id).length}</strong>
              <small>without a department</small>
            </article>
          </section>

          {activeView === 'members' ? (
            <section className="directory-card">
              <div className="card-toolbar">
                <div>
                  <h2>All members <span className="result-count">{members.length}</span></h2>
                  <p>Your people, ready to organize.</p>
                </div>
                <label className="search-field">
                  <Search size={17} />
                  <input
                    type="search"
                    placeholder="Search members"
                    aria-label="Search members"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && <button type="button" className="search-clear" onClick={() => setSearch('')} aria-label="Clear search"><X size={15} /></button>}
                </label>
              </div>

              {filteredMembers.length ? (
                <div className="table-scroll">
                  <table className="directory-table">
                    <thead>
                      <tr><th>MEMBER</th><th>TELEGRAM</th><th>DEPARTMENT</th><th><span className="sr-only">Actions</span></th></tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map((member) => (
                        <tr key={member.id}>
                          <td>
                            <div className="member-cell">
                              <span className="member-avatar">{member.name.trim().slice(0, 1).toUpperCase()}</span>
                              <span className="member-name">{member.name}</span>
                            </div>
                          </td>
                          <td>
                            <div className="telegram-cell">
                              {member.telegram_username ? <><AtSign size={15} /><span>{member.telegram_username}</span></> : null}
                              {member.telegram_id ? <><Send size={14} /><span className="telegram-id">{member.telegram_id}</span></> : null}
                            </div>
                          </td>
                          <td>
                            {member.department ? <span className="department-badge">{member.department.name}</span> : <span className="unassigned">Unassigned</span>}
                          </td>
                          <td>
                            <div className="row-actions">
                              <button className="icon-button" onClick={() => openMemberForm(member)} aria-label={`Edit ${member.name}`} title="Edit member"><span className="edit-glyph">✎</span></button>
                              <button className="icon-button danger-hover" onClick={() => deleteMember(member)} aria-label={`Remove ${member.name}`} title="Remove member"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><Users size={23} /></div>
                  <h3>{search ? 'No matching members' : 'Your directory starts here'}</h3>
                  <p>{search ? 'Try another name, Telegram detail, or department.' : 'Add a member to keep their name and Telegram details handy.'}</p>
                  {!search && <button className="secondary-button" onClick={() => openMemberForm()}><Plus size={16} /> Add your first member</button>}
                </div>
              )}
              <div className="card-footer">
                <span>Showing <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> members</span>
                <span className="footer-secure"><ShieldCheck size={14} /> Private to your workspace</span>
              </div>
            </section>
          ) : (
            <section className="directory-card">
              <div className="card-toolbar">
                <div>
                  <h2>All departments <span className="result-count">{departments.length}</span></h2>
                  <p>Manage your organization’s teams.</p>
                </div>
              </div>
              {departments.length ? (
                <div className="department-list">
                  {departments.map((department) => {
                    const count = members.filter((member) => member.department_id === department.id).length
                    return (
                      <article className="department-row" key={department.id}>
                        <div className="department-icon"><Building2 size={19} /></div>
                        <div className="department-details"><strong>{department.name}</strong><span>{count} {count === 1 ? 'member' : 'members'}</span><span className="department-telegram-title" dir="rtl">{department.telegram_title_ar}</span></div>
                        <div className="row-actions">
                          <button className="icon-button" onClick={() => openDepartmentForm(department)} aria-label={`Edit ${department.name}`} title="Edit department"><span className="edit-glyph">✎</span></button>
                          <button className="icon-button danger-hover" onClick={() => deleteDepartment(department)} aria-label={`Remove ${department.name}`} title="Remove department"><Trash2 size={16} /></button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon"><Building2 size={23} /></div>
                  <h3>No departments yet</h3>
                  <p>Create departments to organize your members.</p>
                  <button className="secondary-button" onClick={() => openDepartmentForm()}><Plus size={16} /> Add your first department</button>
                </div>
              )}
              <div className="card-footer">
                <span><strong>{departments.length}</strong> departments</span>
                <span className="footer-secure"><ShieldCheck size={14} /> Private to your workspace</span>
              </div>
            </section>
          )}
        </div>
      </main>

      {memberDialogOpen && (
        <MemberForm
          member={editingMember}
          departments={departments}
          onSave={saveMember}
          onClose={() => { setMemberDialogOpen(false); setEditingMember(null) }}
        />
      )}
      {departmentDialogOpen && (
        <DepartmentForm
          department={editingDepartment}
          onSave={saveDepartment}
          onClose={() => { setDepartmentDialogOpen(false); setEditingDepartment(null) }}
        />
      )}
    </div>
  )
}

function MemberForm({ member, departments, onSave, onClose }: MemberFormProps) {
  const [name, setName] = useState(member?.name ?? '')
  const [telegramId, setTelegramId] = useState(member?.telegram_id ?? '')
  const [telegramUsername, setTelegramUsername] = useState(member?.telegram_username ?? '')
  const [departmentId, setDepartmentId] = useState(member?.department_id ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const cleanId = telegramId.trim()
    const cleanUsername = telegramUsername.trim().replace(/^@/, '')
    if (!cleanId && !cleanUsername) {
      setError('Add a Telegram ID or username so this member can be identified.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        telegram_id: cleanId || null,
        telegram_username: cleanUsername || null,
        department_id: departmentId || null,
      })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save member.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={member ? 'Edit member' : 'Add a member'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <p className="modal-description">Add a name and at least one Telegram detail. You can add both if you have them.</p>
        <label htmlFor="member-name">Full name <span className="required-mark">*</span></label>
        <input id="member-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Alex Morgan" autoFocus required maxLength={120} />

        <div className="form-two-column">
          <div>
            <label htmlFor="telegram-id">Telegram ID</label>
            <input id="telegram-id" inputMode="numeric" value={telegramId} onChange={(event) => setTelegramId(event.target.value)} placeholder="e.g. 123456789" maxLength={40} />
          </div>
          <div>
            <label htmlFor="telegram-username">Telegram username</label>
            <input id="telegram-username" value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value)} placeholder="e.g. alexmorgan" maxLength={64} />
          </div>
        </div>

        <label htmlFor="member-department">Department <span className="optional-label">Optional</span></label>
        <select id="member-department" value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          <option value="">No department</option>
          {departments.map((department) => <option value={department.id} key={department.id}>{department.name}</option>)}
        </select>

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : member ? 'Save changes' : 'Add member'}</button>
        </div>
      </form>
    </Modal>
  )
}

function DepartmentForm({ department, onSave, onClose }: DepartmentFormProps) {
  const [name, setName] = useState(department?.name ?? '')
  const [telegramTitle, setTelegramTitle] = useState(department?.telegram_title_ar ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({ name: name.trim(), telegram_title_ar: telegramTitle.trim() })
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save department.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={department ? 'Edit department' : 'Add a department'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <p className="modal-description">Give your department a name and Arabic Telegram message title. Members can be assigned now or later.</p>
        <label htmlFor="department-name">Department name <span className="required-mark">*</span></label>
        <input id="department-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Operations" autoFocus required maxLength={100} />
        <label htmlFor="department-telegram-title">Arabic Telegram title <span className="required-mark">*</span></label>
        <input id="department-telegram-title" dir="rtl" lang="ar" value={telegramTitle} onChange={(event) => setTelegramTitle(event.target.value)} placeholder="نــداء الى أعضاء الوحدة" required maxLength={160} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : department ? 'Save changes' : 'Add department'}</button>
        </div>
      </form>
    </Modal>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button>
        </header>
        {children}
      </section>
    </div>
  )
}
