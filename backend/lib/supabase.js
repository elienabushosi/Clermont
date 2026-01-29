// Supabase client configuration
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine environment (default to development)
const nodeEnv = process.env.NODE_ENV || 'development';

// Load environment-specific .env file
const envFile = `.env.${nodeEnv}`;
dotenv.config({ path: join(__dirname, '..', envFile) });

// Also load base .env if it exists (for local overrides)
dotenv.config({ path: join(__dirname, '..', '.env'), override: false });

// Clermont: no fallbacks – use .env.development / .env.production
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (if service key is available)
export const supabaseAdmin = supabaseServiceKey
	? createClient(supabaseUrl, supabaseServiceKey, {
			auth: {
				autoRefreshToken: false,
				persistSession: false,
			},
	  })
	: null;
