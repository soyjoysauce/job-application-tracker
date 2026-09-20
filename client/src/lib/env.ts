// Vite replaces import.meta.env.VITE_* at BUILD time. If a variable is missing when the
// bundle is built, it is `undefined` forever in that deployment — no restart can fix it.
// Checking here turns a blank page (Supabase throwing "supabaseUrl is required") into a
// readable message that names the missing variables.

const required = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
  VITE_API_URL: import.meta.env.VITE_API_URL,
};

/** Names of the variables that were missing when this bundle was built. */
export const missingEnvVars = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([name]) => name);

export const env = required;
