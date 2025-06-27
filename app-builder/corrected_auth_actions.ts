'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    console.error('Login error:', error.message)
    return redirect('/login?error=Invalid credentials')
  }

  return redirect('/dashboard')
}

export async function registerUser(formData: FormData) {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const username = formData.get('username') as string

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username,
      },
    },
  })

  if (signUpError) {
    console.error('Sign up error:', signUpError.message)
    return redirect(`/login?error=${signUpError.message}`)
  }
  
  if (!signUpData.user) {
    console.error('Sign up completed but no user data returned.');
    return redirect('/login?error=Registration failed, please try again.');
  }

  // **THE FIX IS HERE**
  // After a successful sign-up, the user exists in `auth.users`, but not our public `users` table.
  // We need to manually insert their data into the public table.
  const { error: insertError } = await supabase.from('users').insert({
    id: signUpData.user.id, // Use the ID from the successful sign-up
    email: email,
    username: username,
    role: 'user' // Default role as per our spec
  });

  if (insertError) {
    console.error('Error inserting user into public table:', insertError.message);
    // Note: In a real app, you might want to delete the auth user here to avoid orphans.
    return redirect(`/login?error=Registration failed: could not create user profile.`);
  }

  return redirect('/dashboard')
} 