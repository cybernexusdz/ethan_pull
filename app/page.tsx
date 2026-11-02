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

  const [membersResult, departmentsResult] = await Promise.all([
    supabase
      .from('members')
      .select('id, name, telegram_id, telegram_username, department_id, department:departments(name)')
      .order('name'),
    supabase.from('departments').select('id, name, telegram_title_ar').order('name'),
  ])

  return (
    <MembersApp
      email={user.email ?? ''}
      initialMembers={membersResult.data ?? []}
      initialDepartments={departmentsResult.data ?? []}
      loadError={membersResult.error?.message ?? departmentsResult.error?.message ?? null}
    />
  )
}
