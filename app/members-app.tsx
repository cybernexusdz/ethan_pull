'use client'

import { useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  AtSign,
  Building2,
  ChevronDown,
  Filter,
  KeyRound,
  LogOut,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  UserRound,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/client'
import type { Database } from '@/lib/database.types'

type Member = Pick<
  Database['public']['Tables']['members']['Row'],
  'id' | 'name' | 'telegram_id' | 'telegram_username'
> & {
  departments: Array<Pick<Department, 'id' | 'name'>>
}
type Department = Pick<
  Database['public']['Tables']['departments']['Row'],
  'id' | 'name' | 'telegram_title_ar' | 'telegram_help_message'
>
type TelegramCommandUser = Pick<
  Database['public']['Tables']['telegram_command_users']['Row'],
  'id' | 'telegram_id' | 'telegram_username'
>
type TelegramAllowedChat = Pick<
  Database['public']['Tables']['telegram_allowed_chats']['Row'],
  'chat_id' | 'name'
>
type MemberInput = {
  name: string
  telegram_id: string | null
  telegram_username: string | null
  department_ids: string[]
}

type MembersAppProps = {
  email: string
  initialMembers: Member[]
  initialDepartments: Department[]
  initialCommandUsers: TelegramCommandUser[]
  initialAllowedChats: TelegramAllowedChat[]
  initialTargetGroupId: string | null
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
  onSave: (input: Pick<Department, 'name' | 'telegram_title_ar' | 'telegram_help_message'>) => Promise<void>
  onClose: () => void
}

type TelegramCommandUserFormProps = {
  onSave: (identifier: { telegram_id: string | null; telegram_username: string | null }) => Promise<void>
  onClose: () => void
}

type TelegramAllowedChatFormProps = {
  chat: TelegramAllowedChat | null
  onSave: (chatId: string, name: string) => Promise<void>
  onClose: () => void
}

type TelegramTargetGroupFormProps = {
  initialChatId: string | null
  onSave: (chatId: string) => Promise<void>
  onClose: () => void
}

export function MembersApp({
  email,
  initialMembers,
  initialDepartments,
  initialCommandUsers,
  initialAllowedChats,
  initialTargetGroupId,
  loadError,
}: MembersAppProps) {
  const router = useRouter()
  const members = initialMembers
  const departments = initialDepartments
  const [activeView, setActiveView] = useState<'members' | 'departments' | 'command-access'>('members')
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [memberDialogOpen, setMemberDialogOpen] = useState(false)
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false)
  const [commandUserDialogOpen, setCommandUserDialogOpen] = useState(false)
  const [allowedChatDialogOpen, setAllowedChatDialogOpen] = useState(false)
  const [targetGroupDialogOpen, setTargetGroupDialogOpen] = useState(false)
  const [editingAllowedChat, setEditingAllowedChat] = useState<TelegramAllowedChat | null>(null)
  const [editingMember, setEditingMember] = useState<Member | null>(null)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)
  const [actionError, setActionError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase()
    return members.filter((member) => {
      const matchesDepartment = departmentFilter === 'all'
        || (departmentFilter === 'unassigned'
          ? member.departments.length === 0
          : member.departments.some((department) => department.id === departmentFilter))
      const matchesSearch = !query || [
        member.name,
        member.telegram_id ?? '',
        member.telegram_username ?? '',
        ...member.departments.map((department) => department.name),
      ].some((value) => value.toLowerCase().includes(query))

      return matchesDepartment && matchesSearch
    })
  }, [departmentFilter, members, search])
  const hasMemberFilters = Boolean(search.trim()) || departmentFilter !== 'all'

  const departmentMemberCounts = useMemo(() => {
    const counts = new Map<string, number>()

    for (const member of members) {
      for (const department of member.departments) {
        counts.set(
          department.id,
          (counts.get(department.id) ?? 0) + 1,
        )
      }
    }

    return counts
  }, [members])

  async function saveMember(input: MemberInput) {
    const { error } = await createClient().rpc('save_member_with_departments', {
      p_member_id: editingMember?.id ?? null,
      p_name: input.name,
      p_telegram_id: input.telegram_id,
      p_telegram_username: input.telegram_username,
      p_department_ids: input.department_ids,
    })

    if (error) throw new Error(error.message)

    setMemberDialogOpen(false)
    setEditingMember(null)
    setActionError('')
    router.refresh()
  }

  async function saveDepartment(input: Pick<Department, 'name' | 'telegram_title_ar' | 'telegram_help_message'>) {
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

  async function saveCommandUser(input: { telegram_id: string | null; telegram_username: string | null }) {
    const { error } = await createClient()
      .from('telegram_command_users')
      .insert(input)

    if (error) throw new Error(error.message)

    setCommandUserDialogOpen(false)
    setActionError('')
    router.refresh()
  }

  async function deleteCommandUser(commandUser: TelegramCommandUser) {
    const identifier = commandUser.telegram_id
      ? `Telegram ID ${commandUser.telegram_id}`
      : `@${commandUser.telegram_username}`
    if (!window.confirm(`Remove ${identifier} from the bot command allowlist?`)) return

    setActionError('')
    try {
      const { error } = await createClient()
        .from('telegram_command_users')
        .delete()
        .eq('id', commandUser.id)
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to remove the allowed user.')
    }
  }

  async function saveAllowedChat(chatId: string, name: string) {
    const supabase = createClient()
    const result = editingAllowedChat
      ? await supabase
        .from('telegram_allowed_chats')
        .update({ name })
        .eq('chat_id', editingAllowedChat.chat_id)
      : await supabase
        .from('telegram_allowed_chats')
        .insert({ chat_id: chatId, name })

    if (result.error) throw new Error(result.error.message)

    setAllowedChatDialogOpen(false)
    setEditingAllowedChat(null)
    setActionError('')
    router.refresh()
  }

  async function saveTargetGroup(chatId: string) {
    const { error } = await createClient()
      .from('telegram_bot_settings')
      .upsert(
        { id: true, target_group_id: chatId, updated_at: new Date().toISOString() },
        { onConflict: 'id' },
      )

    if (error) throw new Error(error.message)

    setTargetGroupDialogOpen(false)
    setActionError('')
    router.refresh()
  }

  async function deleteAllowedChat(chat: TelegramAllowedChat) {
    if (!window.confirm(`Remove chat ${chat.chat_id} from the bot command allowlist?`)) return

    setActionError('')
    try {
      const { error } = await createClient()
        .from('telegram_allowed_chats')
        .delete()
        .eq('chat_id', chat.chat_id)
      if (error) throw new Error(error.message)
      router.refresh()
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : 'Unable to remove the allowed chat.')
    }
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
    const assignedCount = departmentMemberCounts.get(department.id) ?? 0
    const message = assignedCount
      ? `Remove ${department.name}? ${assignedCount} member${assignedCount === 1 ? '' : 's'} will be removed from this department.`
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

  const viewDetails = {
    members: {
      title: 'Members',
      eyebrow: 'YOUR PEOPLE',
      description: 'Keep your people and their Telegram details in one place.',
      action: 'Add member',
    },
    departments: {
      title: 'Departments',
      eyebrow: 'YOUR ORGANIZATION',
      description: 'Group members into the teams that make up your organization.',
      action: 'Add department',
    },
    'command-access': {
      title: 'Command access',
      eyebrow: 'BOT PERMISSIONS',
      description: 'Choose where commands are accepted, where mentions go, and who can use the bot.',
      action: 'Add allowed chat',
    },
  }[activeView]

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
          <button
            className={`nav-item ${activeView === 'command-access' ? 'active' : ''}`}
            onClick={() => { setActiveView('command-access'); setSearch('') }}
          >
            <KeyRound size={18} />
            <span>Command access</span>
            <span className="nav-count">{initialCommandUsers.length + initialAllowedChats.length}</span>
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
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{viewDetails.title}</strong></div>
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
            <button className={activeView === 'command-access' ? 'active' : ''} onClick={() => { setActiveView('command-access'); setSearch('') }}>
              <KeyRound size={16} /> Access <span>{initialCommandUsers.length + initialAllowedChats.length}</span>
            </button>
          </nav>

          <section className="page-heading">
            <div>
              <div className="eyebrow">{viewDetails.eyebrow}</div>
              <h1>{viewDetails.title}</h1>
              <p>{viewDetails.description}</p>
            </div>
            <button
              className="primary-button"
              onClick={() => {
                if (activeView === 'members') openMemberForm()
                else if (activeView === 'departments') openDepartmentForm()
                else setAllowedChatDialogOpen(true)
              }}
            >
              <Plus size={18} />
              {viewDetails.action}
            </button>
          </section>

          {loadError && (
            <div className="notice notice-error" role="alert">
              <strong>Could not load your directory.</strong>
              <span>{loadError}</span>
              <span>Apply your hosted database migrations with <code>supabase db push --remote</code>, then refresh.</span>
            </div>
          )}
          {actionError && <div className="notice notice-error" role="alert">{actionError}</div>}

          {activeView !== 'command-access' && <section className="stats-grid" aria-label="Directory overview">
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
              <strong>{members.filter((member) => member.departments.length === 0).length}</strong>
              <small>without a department</small>
            </article>
          </section>}

          {activeView === 'members' ? (
            <section className="directory-card">
              <div className="card-toolbar member-card-toolbar">
                <div>
                  <h2>All members <span className="result-count">{members.length}</span></h2>
                  <p>Your people, ready to organize.</p>
                </div>
                <div className="member-list-controls">
                  <label className="department-filter">
                    <Filter size={16} aria-hidden="true" />
                    <span className="sr-only">Filter by department</span>
                    <select
                      aria-label="Filter by department"
                      value={departmentFilter}
                      onChange={(event) => setDepartmentFilter(event.target.value)}
                    >
                      <option value="all">All departments</option>
                      <option value="unassigned">Unassigned</option>
                      {departments.map((department) => (
                        <option value={department.id} key={department.id}>{department.name}</option>
                      ))}
                    </select>
                    <ChevronDown className="department-filter-chevron" size={15} aria-hidden="true" />
                  </label>
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
              </div>

              {filteredMembers.length ? (
                <div className="table-scroll">
                  <table className="directory-table">
                    <thead>
                      <tr><th>MEMBER</th><th>TELEGRAM</th><th>DEPARTMENTS</th><th><span className="sr-only">Actions</span></th></tr>
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
                            {member.departments.length ? (
                              <div className="member-departments">
                                {member.departments.map((department) => (
                                  <span className="department-badge" key={department.id}>{department.name}</span>
                                ))}
                              </div>
                            ) : <span className="unassigned">Unassigned</span>}
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
                  <h3>{hasMemberFilters ? 'No matching members' : 'Your directory starts here'}</h3>
                  <p>{hasMemberFilters ? 'Try a different search or department filter.' : 'Add a member to keep their name and Telegram details handy.'}</p>
                  {hasMemberFilters
                    ? <button className="secondary-button" onClick={() => { setSearch(''); setDepartmentFilter('all') }}><X size={16} /> Clear filters</button>
                    : <button className="secondary-button" onClick={() => openMemberForm()}><Plus size={16} /> Add your first member</button>}
                </div>
              )}
              <div className="card-footer">
                <span>Showing <strong>{filteredMembers.length}</strong> of <strong>{members.length}</strong> members</span>
                <span className="footer-secure"><ShieldCheck size={14} /> Private to your workspace</span>
              </div>
            </section>
          ) : activeView === 'departments' ? (
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
                    const count = departmentMemberCounts.get(department.id) ?? 0
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
          ) : (
            <div className="access-management-grid">
              <section className="directory-card">
                <div className="card-toolbar">
                  <div>
                    <h2>Destination group</h2>
                    <p>Where the bot sends /all and department mentions.</p>
                  </div>
                  <button className="secondary-button" onClick={() => setTargetGroupDialogOpen(true)}>
                    <span className="edit-glyph">✎</span>
                    {initialTargetGroupId ? 'Change group' : 'Set group'}
                  </button>
                </div>
                <div className="department-row">
                  <div className="department-icon access-icon"><Send size={18} /></div>
                  <div className="department-details">
                    <strong>{initialTargetGroupId ? `Chat ID ${initialTargetGroupId}` : 'No destination configured'}</strong>
                    <span>{initialTargetGroupId
                      ? 'Mention commands are sent here'
                      : 'Configure a group before using /all or department commands'}</span>
                  </div>
                </div>
                <div className="access-notice">
                  <ShieldCheck size={18} />
                  <p>This is separate from Allowed chats. The destination receives mentions; Allowed chats control where commands may be issued.</p>
                </div>
              </section>

              <section className="directory-card">
                <div className="card-toolbar">
                  <div>
                    <h2>Allowed chats <span className="result-count">{initialAllowedChats.length}</span></h2>
                    <p>Chats where the bot accepts commands. Group chats allow any listed user below.</p>
                  </div>
                </div>
                <div className="access-notice">
                  <ShieldCheck size={18} />
                  <p>Both the chat and the sender must be allowed. Remove a chat here to block commands from it.</p>
                </div>
                {initialAllowedChats.length ? (
                  <div className="department-list">
                    {initialAllowedChats.map((chat) => (
                      <article className="department-row" key={chat.chat_id}>
                        <div className="department-icon access-icon"><Building2 size={18} /></div>
                        <div className="department-details">
                          <strong>{chat.name}</strong>
                          <span>Chat ID {chat.chat_id}</span>
                          <span>{chat.chat_id.startsWith('-') ? 'Group or channel' : 'Private chat'}</span>
                        </div>
                        <div className="row-actions">
                          <button
                            className="icon-button"
                            onClick={() => {
                              setEditingAllowedChat(chat)
                              setAllowedChatDialogOpen(true)
                            }}
                            aria-label={`Edit name for ${chat.name}`}
                            title="Edit chat name"
                          >
                            <span className="edit-glyph">✎</span>
                          </button>
                          <button
                            className="icon-button danger-hover"
                            onClick={() => deleteAllowedChat(chat)}
                            aria-label={`Remove chat ${chat.chat_id}`}
                            title="Remove allowed chat"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon"><Building2 size={23} /></div>
                    <h3>No chats are allowed</h3>
                    <p>The bot will ignore all commands until you add at least one Telegram chat ID.</p>
                    <button className="secondary-button" onClick={() => setAllowedChatDialogOpen(true)}><Plus size={16} /> Add the first chat</button>
                  </div>
                )}
                <div className="card-footer">
                  <span><strong>{initialAllowedChats.length}</strong> allowed {initialAllowedChats.length === 1 ? 'chat' : 'chats'}</span>
                  <span className="footer-secure"><ShieldCheck size={14} /> Private to your workspace</span>
                </div>
              </section>

              <section className="directory-card">
                <div className="card-toolbar">
                  <div>
                    <h2>Allowed users <span className="result-count">{initialCommandUsers.length}</span></h2>
                    <p>Only these people can run commands in an allowed chat.</p>
                  </div>
                  <button className="secondary-button" onClick={() => setCommandUserDialogOpen(true)}>
                    <Plus size={16} /> Allow a user
                  </button>
                </div>
                {initialCommandUsers.length ? (
                  <div className="department-list">
                    {initialCommandUsers.map((commandUser) => (
                      <article className="department-row" key={commandUser.id}>
                        <div className="department-icon access-icon"><UserRound size={18} /></div>
                        <div className="department-details">
                          <strong>{commandUser.telegram_id
                            ? `Telegram ID ${commandUser.telegram_id}`
                            : `@${commandUser.telegram_username}`}</strong>
                          <span>{commandUser.telegram_id ? 'Matched by stable Telegram user ID' : 'Matched by Telegram username'}</span>
                        </div>
                        <div className="row-actions">
                          <button
                            className="icon-button danger-hover"
                            onClick={() => deleteCommandUser(commandUser)}
                            aria-label={`Remove ${commandUser.telegram_id ? `Telegram ID ${commandUser.telegram_id}` : `@${commandUser.telegram_username}`}`}
                            title="Remove allowed user"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon"><KeyRound size={23} /></div>
                    <h3>No one is allowed to run commands</h3>
                    <p>The bot will deny every command until you add at least one Telegram ID or username.</p>
                    <button className="secondary-button" onClick={() => setCommandUserDialogOpen(true)}><Plus size={16} /> Allow the first user</button>
                  </div>
                )}
                <div className="card-footer">
                  <span><strong>{initialCommandUsers.length}</strong> allowed {initialCommandUsers.length === 1 ? 'user' : 'users'}</span>
                  <span className="footer-secure"><ShieldCheck size={14} /> Private to your workspace</span>
                </div>
              </section>
            </div>
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
      {commandUserDialogOpen && (
        <TelegramCommandUserForm
          onSave={saveCommandUser}
          onClose={() => setCommandUserDialogOpen(false)}
        />
      )}
      {allowedChatDialogOpen && (
        <TelegramAllowedChatForm
          chat={editingAllowedChat}
          onSave={saveAllowedChat}
          onClose={() => {
            setAllowedChatDialogOpen(false)
            setEditingAllowedChat(null)
          }}
        />
      )}
      {targetGroupDialogOpen && (
        <TelegramTargetGroupForm
          initialChatId={initialTargetGroupId}
          onSave={saveTargetGroup}
          onClose={() => setTargetGroupDialogOpen(false)}
        />
      )}
    </div>
  )
}

function MemberForm({ member, departments, onSave, onClose }: MemberFormProps) {
  const [name, setName] = useState(member?.name ?? '')
  const [telegramId, setTelegramId] = useState(member?.telegram_id ?? '')
  const [telegramUsername, setTelegramUsername] = useState(member?.telegram_username ?? '')
  const [departmentIds, setDepartmentIds] = useState(member?.departments.map(({ id }) => id) ?? [])
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
        department_ids: departmentIds,
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

        <fieldset className="department-checkboxes">
          <legend>Departments <span className="optional-label">Optional</span></legend>
          {departments.length ? (
            <div className="department-checkbox-list">
              {departments.map((department) => (
                <label className="department-option" key={department.id}>
                  <input
                    type="checkbox"
                    checked={departmentIds.includes(department.id)}
                    onChange={(event) => {
                      setDepartmentIds((current) => event.target.checked
                        ? [...current, department.id]
                        : current.filter((id) => id !== department.id))
                    }}
                  />
                  <span>{department.name}</span>
                </label>
              ))}
            </div>
          ) : <p className="department-options-empty">Create a department to assign members.</p>}
        </fieldset>

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
  const [telegramHelpMessage, setTelegramHelpMessage] = useState(department?.telegram_help_message ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        telegram_title_ar: telegramTitle.trim(),
        telegram_help_message: telegramHelpMessage.trim() || null,
      })
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
        <label htmlFor="department-telegram-help">Custom /help message <span className="optional-label">Optional</span></label>
        <input
          id="department-telegram-help"
          value={telegramHelpMessage}
          onChange={(event) => setTelegramHelpMessage(event.target.value)}
          placeholder={`Default: Tag members in ${name || 'this department'}`}
          maxLength={160}
        />
        <p className="form-hint">Shown next to this department’s command in /help and Telegram’s command menu.</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : department ? 'Save changes' : 'Add department'}</button>
        </div>
      </form>
    </Modal>
  )
}

function TelegramCommandUserForm({ onSave, onClose }: TelegramCommandUserFormProps) {
  const [identifier, setIdentifier] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = identifier.trim()
    const username = value.replace(/^@/, '')
    const input = /^[0-9]{1,20}$/.test(value)
      ? { telegram_id: value, telegram_username: null }
      : /^[A-Za-z0-9_]{5,32}$/.test(username)
        ? { telegram_id: null, telegram_username: username.toLowerCase() }
        : null

    if (!input) {
      setError('Enter a numeric Telegram user ID or a username with 5–32 letters, numbers, or underscores.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(input)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to allow this Telegram user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Allow a Telegram user" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <p className="modal-description">Allow one person to run bot commands in chats listed in the bot’s chat allowlist. Telegram user IDs are more reliable than usernames.</p>
        <label htmlFor="telegram-command-user">Telegram user ID or username <span className="required-mark">*</span></label>
        <input
          id="telegram-command-user"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="e.g. 123456789 or @alexmorgan"
          autoFocus
          required
          maxLength={33}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Allow user'}</button>
        </div>
      </form>
    </Modal>
  )
}

function TelegramAllowedChatForm({ chat, onSave, onClose }: TelegramAllowedChatFormProps) {
  const [chatId, setChatId] = useState(chat?.chat_id ?? '')
  const [name, setName] = useState(chat?.name ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = chatId.trim()
    const cleanName = name.trim()
    if (!chat && !/^-?[1-9][0-9]{0,19}$/.test(value)) {
      setError('Enter a non-zero numeric Telegram chat ID. Group IDs are usually negative.')
      return
    }
    if (!cleanName || cleanName.length > 80) {
      setError('Enter a chat name up to 80 characters long.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(value, cleanName)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save this Telegram chat.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={chat ? 'Edit allowed chat' : 'Add an allowed chat'} onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <p className="modal-description">{chat
          ? 'Change the label shown for this chat. The Telegram ID stays the same.'
          : 'Name this chat so it is easy to recognize, then allow commands in it. In groups, only people on the Allowed users list can run commands.'}</p>
        <label htmlFor="telegram-allowed-chat-name">Chat name <span className="required-mark">*</span></label>
        <input
          id="telegram-allowed-chat-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. HR Group"
          autoFocus
          required
          maxLength={80}
        />
        {!chat && (
          <>
            <label htmlFor="telegram-allowed-chat-id">Telegram chat ID <span className="required-mark">*</span></label>
            <input
              id="telegram-allowed-chat-id"
              inputMode="numeric"
              value={chatId}
              onChange={(event) => setChatId(event.target.value)}
              placeholder="e.g. -1001234567890"
              required
              maxLength={21}
            />
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : chat ? 'Save name' : 'Allow chat'}</button>
        </div>
      </form>
    </Modal>
  )
}

function TelegramTargetGroupForm({ initialChatId, onSave, onClose }: TelegramTargetGroupFormProps) {
  const [chatId, setChatId] = useState(initialChatId ?? '')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = chatId.trim()
    if (!/^-[1-9][0-9]{0,19}$/.test(value)) {
      setError('Enter a negative numeric Telegram group ID, usually starting with -100.')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(value)
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to save the destination group.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Set the destination group" onClose={onClose}>
      <form className="modal-form" onSubmit={handleSubmit}>
        <p className="modal-description">The bot sends /all and department mentions to this Telegram group. To keep topic replies, issue commands in this same group.</p>
        <label htmlFor="telegram-target-group">Telegram group ID <span className="required-mark">*</span></label>
        <input
          id="telegram-target-group"
          inputMode="numeric"
          value={chatId}
          onChange={(event) => setChatId(event.target.value)}
          placeholder="e.g. -1001234567890"
          autoFocus
          required
          maxLength={21}
        />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save group'}</button>
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
