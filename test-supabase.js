#!/usr/bin/env node
/**
 * Supabase Connection Test Script
 * 
 * Run this to verify your Supabase connection:
 *   node test-supabase.js
 */

require('dotenv').config();

const { getSupabase, getSupabaseAdmin, isConfigured, verifyConnection } = require('./server/supabase');

async function testSupabase() {
    console.log('\n🔍 Testing Supabase Connection...\n');
    
    // Check configuration
    console.log('📋 Configuration:');
    console.log('  SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Set' : '❌ Missing');
    console.log('  SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
    console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
    
    if (!isConfigured()) {
        console.log('\n❌ Supabase is not configured properly.');
        console.log('Please check your .env file and add the required keys.\n');
        process.exit(1);
    }
    
    // Verify connection
    console.log('\n🌐 Testing connection...');
    const result = await verifyConnection();
    
    if (result.success) {
        console.log('✅ Connection successful!');
        console.log(`   ${result.message}`);
    } else {
        console.log('❌ Connection failed:', result.error);
    }
    
    // Test auth
    console.log('\n🔐 Testing authentication...');
    try {
        const supabase = getSupabaseAdmin();
        
        // Try to get current user info (should fail with invalid token, but proves client works)
        const { data, error } = await supabase.auth.getUser();
        
        if (error) {
            console.log('⚠️  Auth client works (expected error with no token):', error.message);
        } else {
            console.log('✅ Auth client working');
        }
    } catch (err) {
        console.log('❌ Auth test failed:', err.message);
    }
    
    console.log('\n📝 Next Steps:');
    console.log('1. Make sure Twitch is enabled in Supabase → Authentication → Providers → Twitch');
    console.log('2. Test OAuth flow at http://localhost:3000/api/auth/twitch');
    console.log('\n');
}

testSupabase().catch(console.error);
