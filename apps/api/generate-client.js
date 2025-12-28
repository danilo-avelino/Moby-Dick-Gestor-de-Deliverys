const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Robust Prisma Generation (Build Time - Direct Binary)...');

const buildSchemaPath = path.resolve(__dirname, 'schema.build.prisma');
const schemaPath = path.resolve(__dirname, 'schema.prisma');

try {
    // 4. Generate with local binary (relying on package.json dependencies installed by Cloud Build)
    console.log('Running generation with local binary...');
    const localPrisma = path.resolve(__dirname, 'node_modules', '.bin', 'prisma');
    const prismaCmd = fs.existsSync(localPrisma) ? localPrisma : 'npx prisma'; // Fallback if binary not found directly

    execSync(`${prismaCmd} generate --schema="${buildSchemaPath}"`, {
        stdio: 'inherit',
        env: {
            ...process.env,
            DATABASE_URL: 'postgresql://dummy:dummy@localhost:5432/dummy'
        }
    });

    console.log('Generation success.');

} catch (error) {
    console.error('Generation script failed:', error.message);
    process.exit(1);
}
