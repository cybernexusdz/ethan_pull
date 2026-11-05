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

  const [membersResult, assignmentsResult, departmentsResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, telegram_id, telegram_username')
      .order('name'),
    supabase.from('member_departments').select('member_id, department_id'),
    supabase.from('departments').select('id, name, telegram_title_ar').order('name'),
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
      loadError={
        membersResult.error?.message ??
        assignmentsResult.error?.message ??
        departmentsResult.error?.message ??
        null
      }
    />
  )
}
