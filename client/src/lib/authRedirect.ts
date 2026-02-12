export function redirectToLogin() {
  const hasSupabaseAuth =
    Boolean(import.meta.env.VITE_SUPABASE_URL) &&
    Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

  if (hasSupabaseAuth) {
    window.location.href = "/login";
    return;
  }

  window.location.href = "/api/login";
}
