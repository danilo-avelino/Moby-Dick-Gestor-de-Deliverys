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

    // 4. Resolve binary directly to bypass npx caching/magic
    const prismaBin = path.resolve(__dirname, 'node_modules', '.bin', 'prisma');

    if (!fs.existsSync(prismaBin)) {
        console.error('Prisma binary not found at:', prismaBin);
        // Fallback to npx but likely fail
        throw new Error('Prisma binary missing after install');
    }

    console.log('Using direct binary:', prismaBin);

    // Check version
    try {
        execSync(`"${prismaBin}" -v`, { stdio: 'inherit' });
    } catch (e) { console.log('Version check failed'); }

    // 5. Generate with dummy env
    console.log('Running generation...');
    execSync(`"${prismaBin}" generate --schema="${buildSchemaPath}"`, {
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
