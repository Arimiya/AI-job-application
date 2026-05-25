# Supabase Setup for CareerAI

This app can run with localStorage only, or with Supabase as the database.

## 1. Create a Supabase project

Create a new project from the Supabase dashboard. Copy:

- Project URL
- Publishable key, or legacy anon public key

Do not put the service role key in this frontend app.

## 2. Run the schema

Open the Supabase SQL editor and run:

```sql
-- paste the contents of supabase/schema.sql
```

The schema creates:

- `profiles`
- `resumes`
- `cover_letters`
- `jobs`
- `ats_results`

All exposed tables have Row Level Security enabled. Rows are owned by the current Supabase Auth user.

## 3. Configure Auth

Go to Authentication > Sign In / Providers:

- Enable Email sign-ins for the Log In and Sign Up forms.
- Enable Google if you want the "Sign up with Google" button to redirect through OAuth.
- Anonymous sign-ins are optional. They are only used when you intentionally keep the app in demo mode with Supabase configured.

Each signed-in user owns their own `profiles`, `resumes`, `cover_letters`, `jobs`, and `ats_results` rows. RLS keeps those rows separate.

## 4. Add your project keys

Open `supabase-config.js` and replace:

```js
url: "https://YOUR_PROJECT_ID.supabase.co",
publishableKey: "YOUR_SUPABASE_PUBLISHABLE_KEY"
```

After that, refresh the app. It will show a toast when Supabase is connected.

## Notes

If Supabase is not configured or the network is unavailable, the dashboard still works with localStorage.

Supabase documentation recommends using grants plus RLS together for Data API access. This schema grants access only to the `authenticated` role and keeps anonymous unauthenticated table access closed.
