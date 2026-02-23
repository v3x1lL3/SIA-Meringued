# Turn off "Waiting for verification" – auto sign-in after sign-up

To let users sign in immediately after signing up (no email verification step):

1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** and select your project.

2. Go to **Authentication** → **Providers** (left sidebar).

3. Click **Email**.

4. Find **"Confirm email"** and **turn it OFF** (toggle to disabled).

5. Save if there is a Save button.

After this, new sign-ups get a session right away and are redirected to the dashboard without waiting for a verification email. Existing users who were stuck "waiting for verification" can sign in with their password; no verification link is required.

**Note:** You need **Owner** or **Admin** access to the project to change this. If you only have "Developer" role, ask the project owner to disable Confirm email.
