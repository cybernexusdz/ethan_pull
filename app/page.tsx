import { MembersApp } from './members-app'
import { SignInForm } from './sign-in-form'
import { createClient } from '@/lib/server'

export const instant = false

export default async function Home() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    return <SignInForm initialError={`We couldn't verify your session: ${authError.message}`} />
  }

  if (!user) {
    return <SignInForm />
  }

  const [
    membersResult,
    assignmentsResult,
    departmentsResult,
    commandUsersResult,
    allowedChatsResult,
    botSettingsResult,
  ] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, telegram_id, telegram_username')
      .order('name'),
    supabase.from('member_departments').select('member_id, department_id'),
    supabase.from('departments').select('id, name, telegram_title_ar').order('name'),
    supabase
      .from('telegram_command_users')
      .select('id, telegram_id, telegram_username, created_at')
      .order('created_at'),
    supabase
      .from('telegram_allowed_chats')
      .select('chat_id, name, created_at')
      .order('created_at'),
    supabase
      .from('telegram_bot_settings')
      .select('target_group_id')
      .eq('id', true)
      .maybeSingle(),
  ])

  const departmentsById = new Map(
    (departmentsResult.data ?? []).map(({ id, name }) => [id, { id, name }]),
  )
  const departmentsByMember = new Map<string, { id: string; name: string }[]>()
  for (const assignment of assignmentsResult.data ?? []) {
    const department = departmentsById.get(assignment.department_id)
    if (!department) continue

    const memberDepartments = departmentsByMember.get(assignment.member_id) ?? []
    memberDepartments.push(department)
    departmentsByMember.set(assignment.member_id, memberDepartments)
  }
  const members = (membersResult.data ?? []).map((member) => ({
    ...member,
    departments: departmentsByMember.get(member.id) ?? [],
  }))

  return (
    <MembersApp
      email={user.email ?? ''}
      initialMembers={members}
      initialDepartments={departmentsResult.data ?? []}
      initialCommandUsers={commandUsersResult.data ?? []}
      initialAllowedChats={allowedChatsResult.data ?? []}
      initialTargetGroupId={botSettingsResult.data?.target_group_id ?? null}
      loadError={
        membersResult.error?.message ??
        assignmentsResult.error?.message ??
        departmentsResult.error?.message ??
        commandUsersResult.error?.message ??
        allowedChatsResult.error?.message ??
        botSettingsResult.error?.message ??
        null
      }
    />
  )
}
