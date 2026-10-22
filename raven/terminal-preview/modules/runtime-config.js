// Public configuration only. Keep service-role and Google client secrets in Supabase.
// The local investigation works while these values are empty.
export const CLOUD_CONFIG = Object.freeze({
  supabaseUrl: '',
  publishableKey: '',
  functionName: 'raven-api',
  redirectPath: 'case-017/',
});
