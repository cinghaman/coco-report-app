import { redirect } from 'next/navigation'

export default function HomePage() {
  // Redirect to the clean login page
  redirect('/login')
}