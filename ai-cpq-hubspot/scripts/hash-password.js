#!/usr/bin/env node
/**
 * Generate a bcrypt hash for your admin password.
 * Usage: node scripts/hash-password.js [password]
 * Example: node scripts/hash-password.js Soccer123
 */

const bcrypt = require('bcryptjs')
const password = process.argv[2] || 'Soccer123'

bcrypt.hash(password, 10).then((hash) => {
  console.log('\n=== Password Hash Generated ===')
  console.log(`Password: ${password}`)
  console.log(`Hash:     ${hash}`)
  console.log('\nAdd this to your .env.local:')
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`)
}).catch(console.error)
