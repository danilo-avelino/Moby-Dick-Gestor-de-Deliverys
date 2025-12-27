const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Starting Robust Prisma Generation (Build Time - Direct Binary)...');

const buildSchemaPath = path.resolve(__dirname, 'schema.build.prisma');
const schemaPath = path.resolve(__dirname, 'schema.prisma');

try {
    // 1. Force install correct versions locally
    console.log('Forcing installation of Prisma 5.7.0...');
    execSync('npm install prisma@5.7.0 @prisma/client@5.7.0 --no-save --no-audit', { stdio: 'inherit' });

    // 2. Read original schema
    let schemaContent = fs.readFileSync(schemaPath, 'utf8');

    // 3. Patch schema to use env variable (standard)
    if (!schemaContent.includes('env("DATABASE_URL")')) {
        schemaContent = schemaContent.replace(/url\s*=\s*".*"/, 'url = env("DATABASE_URL")');
    }

    fs.writeFileSync(buildSchemaPath, schemaContent);

    // 4. Generate with npx (safer for path resolution)
    console.log('Running generation with npx...');
    execSync(`npx prisma generate --schema="${buildSchemaPath}"`, {
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
