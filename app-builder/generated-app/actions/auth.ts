'use server';

import { cookies } from 'next/headers';
import createServerClient from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { UserRole } from '@/types/supabase';

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string | null;
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);

  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    return { success: false, message: error.message };
  }

  if (data.user) {
    const workspaceId = crypto.randomUUID(); // Generate a new workspace ID for new user

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        email: data.user.email!,
        workspace_id: workspaceId,
        role: 'employee' as UserRole,
        full_name: fullName
      });

    if (insertError) {
      // If profile insertion fails, attempt to delete the auth user to prevent orphaned accounts
      await supabase.auth.admin.deleteUser(data.user.id);
      return { success: false, message: `Failed to create profile: ${insertError.message}` };
    }

    // Update the user's app_metadata with the workspace_id
    const { error: metadataError } = await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { workspace_id: workspaceId }
    });

    if (metadataError) {
      return { success: false, message: `Failed to update user metadata: ${metadataError.message}` };
    }
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signOut() {
  const cookieStore = cookies();
  const supabase = createServerClient(cookieStore);
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/login');
}
