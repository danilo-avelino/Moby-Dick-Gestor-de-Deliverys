
async function main() {
    const port = 3001;
    const baseUrl = `http://localhost:${port}`;
    console.log(`Checking server at ${baseUrl}...`);

    try {
        // 1. Health verify
        console.log('1. Health Check');
        const healthRes = await fetch(`${baseUrl}/health`);
        console.log('Health Status:', healthRes.status);
        console.log('Health Body:', await healthRes.text());

        // 2. Login verify
        console.log('2. Login Check');
        const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'admin@burgerhouse.com.br',
                password: 'password123'
            })
        });

        console.log('Login Status:', loginRes.status);
        const text = await loginRes.text();
        console.log('Login Body:', text);

    } catch (err) {
        console.error('Check failed:', err);
    }
}

main();
