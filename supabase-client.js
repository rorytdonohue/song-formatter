// Supabase client configuration
// This file can be used in both Node.js (server) and browser (frontend)

// For Node.js / Server-side
if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    require('dotenv').config();
}

// Get Supabase credentials from environment or window object
const getSupabaseConfig = () => {
    // Check if running in Node.js
    if (typeof process !== 'undefined' && process.env) {
        return {
            url: process.env.SUPABASE_URL,
            anonKey: process.env.SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY
        };
    }
    
    // Check if running in browser with window.SUPABASE_CONFIG
    if (typeof window !== 'undefined' && window.SUPABASE_CONFIG) {
        return window.SUPABASE_CONFIG;
    }
    
    throw new Error('Supabase configuration not found. Please set environment variables or window.SUPABASE_CONFIG');
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSupabaseConfig };
}

