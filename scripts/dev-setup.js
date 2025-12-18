#!/usr/bin/env node

/**
 * Development setup script for TestFlow AI
 * Run this after cloning the repository
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up TestFlow AI development environment...\n');

// Check if .env.local exists
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.local file...');
  const envContent = `# Database
DATABASE_URL="file:./dev.db"

# OpenAI Configuration (replace with your actual keys)
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=baidu/ernie-4.5-21b-a3b
OPENAI_VISION_MODEL=gpt-4o

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=10

# Max tokens for AI responses
MAX_TOKENS=4000
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env.local with default values');
  console.log('⚠️  Please update OPENAI_API_KEY with your actual API key\n');
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed\n');
} catch (error) {
  console.error('❌ Failed to install dependencies');
  process.exit(1);
}

// Generate Prisma client
console.log('🗄️  Setting up database...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.warn('⚠️  Prisma client generation failed (this is OK for initial setup)');
}

// Push database schema
try {
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('✅ Database schema pushed\n');
} catch (error) {
  console.log('⚠️  Database push failed (this is OK if SQLite is not available yet)\n');
}

console.log('🎉 Setup complete!');
console.log('\nNext steps:');
console.log('1. Update .env.local with your OpenAI API key');
console.log('2. Run: npm run dev');
console.log('3. Open http://localhost:3000\n');

console.log('📚 Useful commands:');
console.log('- npm run dev          # Start development server');
console.log('- npx prisma studio    # View database in browser');
console.log('- npx prisma db push   # Update database schema');
console.log('- npm run build        # Build for production\n');
