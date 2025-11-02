// ============================================================================
// Supabase Configuration
// ============================================================================
// 
// IMPORTANT: Replace the placeholder values below with your actual Supabase
// project credentials. You can find these in your Supabase dashboard:
//
// 1. Go to: https://app.supabase.com/project/YOUR_PROJECT/settings/api
// 2. Copy the "Project URL" → paste as 'url' below
// 3. Copy the "anon public" key → paste as 'anonKey' below
// 4. Restart your dev server after making changes
//
// ============================================================================

export const SUPABASE_CONFIG = {
  url: 'https://lmdpljslinochxrlghqz.supabase.co',
  
  // ⚠️ REPLACE THIS WITH YOUR ACTUAL ANON KEY FROM SUPABASE DASHBOARD
  // Go to: Project Settings → API → Project API keys → anon public
  anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE'
};

// ============================================================================
// Alternative: Use .env file (recommended for production)
// ============================================================================
// 1. Create a .env file in the frontend directory
// 2. Add these lines:
//    VITE_SUPABASE_URL=https://your-project.supabase.co
//    VITE_SUPABASE_ANON_KEY=your_actual_anon_key_here
// 3. Restart your development server
// ============================================================================

