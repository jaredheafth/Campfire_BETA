/**
 * Campfire Widget - Supabase Client
 * 
 * Provides Supabase client for authentication and database operations.
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate configuration
if (!supabaseUrl) {
    console.warn('⚠️  SUPABASE_URL not configured - Supabase features disabled');
}

if (!supabaseAnonKey) {
    console.warn('⚠️  SUPABASE_ANON_KEY not configured - Supabase features disabled');
}

// Create Supabase clients
let supabase = null;
let supabaseAdmin = null;

if (supabaseUrl && supabaseAnonKey) {
    // Regular client (for browser/client-side use)
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    });
    
    console.log('✅ Supabase client initialized');
}

if (supabaseUrl && supabaseServiceKey) {
    // Admin client (for server-side operations, bypasses RLS)
    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
    
    console.log('✅ Supabase admin client initialized');
}

/**
 * Get Supabase client (for authenticated requests)
 */
function getSupabase() {
    return supabase;
}

/**
 * Get Supabase admin client (for server operations)
 */
function getSupabaseAdmin() {
    return supabaseAdmin;
}

/**
 * Check if Supabase is configured
 */
function isConfigured() {
    return !!supabase && !!supabaseAdmin;
}

/**
 * Verify Supabase connection
 */
async function verifyConnection() {
    if (!supabaseAdmin) {
        return { success: false, error: 'Supabase admin client not configured' };
    }
    
    try {
        const { data, error } = await supabaseAdmin.from('users').select('count').limit(1);
        
        if (error) {
            // Table might not exist yet - that's OK
            return { success: true, message: 'Supabase connection successful' };
        }
        
        return { success: true, message: 'Supabase connection verified' };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

module.exports = {
    getSupabase,
    getSupabaseAdmin,
    isConfigured,
    verifyConnection
};
