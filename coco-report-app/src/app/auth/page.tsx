import { redirect } from 'next/navigation'

export default function AuthPage() {
  // Redirect to the new unified login page
  redirect('/login')
}
