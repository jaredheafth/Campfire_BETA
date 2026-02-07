/**
 * Campfire Widget - Database Connection
 * 
 * PostgreSQL database connection pool and utilities.
 * Supports:
 * - Railway PostgreSQL (DATABASE_URL)
 * - Local PostgreSQL (CAMPFIRE_DB_URL)
 * - SQLite fallback for development (sql.js - pure JS, no compilation needed)
 */

const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Environment configuration
const config = {
    // PostgreSQL connection string (Railway provides this)
    databaseUrl: process.env.DATABASE_URL || process.env.CAMPFIRE_DB_URL,
    
    // Connection pool settings
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    
    // SSL for production
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create connection pool
let pool = null;
let sqliteDb = null;
let sqlJsInit = null;

/**
 * Initialize database connection
 */
async function initializeDatabase() {
    if (pool) {
        return pool;
    }

    // Check if we should use SQLite for development
    const useSqlite = process.env.USE_SQLITE === 'true' || !config.databaseUrl;
    
    if (useSqlite) {
        console.log('📦 Using SQLite for development (set DATABASE_URL for PostgreSQL)');
        pool = await createSqlitePool();
    } else {
        console.log('🗄️ Connecting to PostgreSQL...');
        pool = createPostgresPool();
    }

    // Test connection
    try {
        const client = await pool.connect();
        console.log('✅ Database connected successfully');
        client.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        
        // Fallback to SQLite if PostgreSQL fails
        if (!useSqlite) {
            console.log('⚠️ Falling back to SQLite...');
            pool = await createSqlitePool();
        }
    }

    return pool;
}

/**
 * Create PostgreSQL connection pool
 */
function createPostgresPool() {
    return new Pool({
        connectionString: config.databaseUrl,
        max: config.max,
        idleTimeoutMillis: config.idleTimeoutMillis,
        connectionTimeoutMillis: config.connectionTimeoutMillis,
        ssl: config.ssl
    });
}

/**
 * Create SQLite pool using sql.js (pure JavaScript, no native compilation)
 */
async function createSqlitePool() {
    try {
        // Initialize sql.js only once
        if (!sqlJsInit) {
            const initSqlJs = require('sql.js');
            sqlJsInit = await initSqlJs();
        }
        
        const dbPath = path.join(__dirname, 'campfire_dev.sqlite');
        
        // Load existing database or create new one
        if (fs.existsSync(dbPath)) {
            const fileBuffer = fs.readFileSync(dbPath);
            sqliteDb = new sqlJsInit.Database(fileBuffer);
            console.log(`📦 SQLite database loaded from: ${dbPath}`);
        } else {
            sqliteDb = new sqlJsInit.Database();
            console.log(`📦 SQLite database created at: ${dbPath}`);
        }
        
        // Enable foreign keys
        sqliteDb.run('PRAGMA foreign_keys = ON');
        
        return {
            query: (sql, params) => {
                try {
                    const stmt = sqliteDb.prepare(sql);
                    
                    if (params && params.length > 0) {
                        stmt.bind(params);
                    } else {
                        stmt.bind();
                    }
                    
                    const results = [];
                    while (stmt.step()) {
                        results.push(stmt.getAsObject());
                    }
                    stmt.free();
                    
                    return { rows: results };
                } catch (error) {
                    // Try as run operation for INSERT/UPDATE/DELETE
                    try {
                        sqliteDb.run(sql, params || []);
                        return { rows: [], affectedRows: sqliteDb.getRowsModified() };
                    } catch (runError) {
                        throw error;
                    }
                }
            },
            connect: () => ({
                query: (sql, params) => {
                    try {
                        const stmt = sqliteDb.prepare(sql);
                        
                        if (params && params.length > 0) {
                            stmt.bind(params);
                        } else {
                            stmt.bind();
                        }
                        
                        const results = [];
                        while (stmt.step()) {
                            results.push(stmt.getAsObject());
                        }
                        stmt.free();
                        
                        return { rows: results };
                    } catch (error) {
                        try {
                            sqliteDb.run(sql, params || []);
                            return { rows: [], affectedRows: sqliteDb.getRowsModified() };
                        } catch (runError) {
                            throw error;
                        }
                    }
                },
                release: () => {}
            }),
            end: () => {
                if (sqliteDb) {
                    const data = sqliteDb.export();
                    const buffer = Buffer.from(data);
                    fs.writeFileSync(dbPath, buffer);
                    sqliteDb.close();
                }
            }
        };
    } catch (error) {
        console.error('SQLite not available, using memory fallback');
        return createMemoryPool();
    }
}

/**
 * Memory pool (ultimate fallback for testing)
 */
function createMemoryPool() {
    const memoryStore = new Map();
    
    return {
        query: (sql, params) => {
            console.log('📝 Memory pool query:', sql.substring(0, 50));
            return { rows: [], rowCount: 0 };
        },
        connect: () => ({
            query: (sql, params) => ({ rows: [], rowCount: 0 }),
            release: () => {}
        }),
        end: () => {}
    };
}

/**
 * Execute a query with error handling
 */
async function query(text, params) {
    const pool = await initializeDatabase();
    const start = Date.now();
    
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        
        if (process.env.DEBUG_SQL) {
            console.log('SQL:', text.substring(0, 100), '| Duration:', duration + 'ms');
        }
        
        return result;
    } catch (error) {
        console.error('Query error:', error.message);
        throw error;
    }
}

/**
 * Get a client from the pool (for transactions)
 */
async function getClient() {
    const pool = await initializeDatabase();
    return pool.connect();
}

/**
 * Execute a transaction
 */
async function transaction(callback) {
    const client = await getClient();
    
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Close database connection
 */
async function close() {
    if (pool && pool.end) {
        await pool.end();
        pool = null;
        console.log('🔌 Database connection closed');
    }
}

/**
 * Health check
 */
async function healthCheck() {
    try {
        await query('SELECT 1');
        return { status: 'healthy', database: 'connected' };
    } catch (error) {
        return { status: 'unhealthy', error: error.message };
    }
}

/**
 * Run database migrations
 */
async function runMigrations() {
    const migrationsDir = path.join(__dirname, 'migrations');
    
    if (!fs.existsSync(migrationsDir)) {
        console.log('No migrations directory found');
        return;
    }
    
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    
    // Create migrations tracking table if not exists
    await query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            migration_name VARCHAR(255) PRIMARY KEY,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Get already executed migrations
    const executedResult = await query(`
        SELECT migration_name FROM schema_migrations
    `);
    const executed = new Set(executedResult.rows.map(r => r.migration_name));
    
    // Run pending migrations
    for (const file of files) {
        if (executed.has(file)) {
            console.log(`⏭️  Skipping migration: ${file}`);
            continue;
        }
        
        console.log(`🚀 Running migration: ${file}`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        try {
            await query(sql);
            await query(`INSERT INTO schema_migrations (migration_name) VALUES ($1)`, [file]);
            console.log(`✅ Migration complete: ${file}`);
        } catch (error) {
            console.error(`❌ Migration failed: ${file}`, error.message);
            throw error;
        }
    }
}

/**
 * Seed database with initial data
 */
async function runSeeds() {
    const seedsDir = path.join(__dirname, 'seeders');
    
    if (!fs.existsSync(seedsDir)) {
        console.log('No seeders directory found');
        return;
    }
    
    const files = fs.readdirSync(seedsDir)
        .filter(f => f.endsWith('.js') || f.endsWith('.sql'))
        .sort();
    
    for (const file of files) {
        console.log(`🌱 Running seeder: ${file}`);
        
        if (file.endsWith('.sql')) {
            const sql = fs.readFileSync(path.join(seedsDir, file), 'utf8');
            await query(sql);
        } else {
            const seeder = require(path.join(seedsDir, file));
            await seeder.up(query);
        }
        
        console.log(`✅ Seeder complete: ${file}`);
    }
}

module.exports = {
    initializeDatabase,
    query,
    getClient,
    transaction,
    close,
    healthCheck,
    runMigrations,
    runSeeds
};
