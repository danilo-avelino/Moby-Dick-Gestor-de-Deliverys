
async function main() {
    console.log('Probing live server...');
    const ports = [3001, 3333, 3000, 8080];

    for (const port of ports) {
        const url = `http://localhost:${port}/health`;
        try {
            console.log(`Checking ${url}...`);
            const res = await fetch(url);
            console.log(`Port ${port} is UP! Status: ${res.status}`);
            console.log('Response:', await res.text());

            // If up, try login
            console.log(`Attempting login on port ${port}...`);
            const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: 'admin@burgerhouse.com.br',
                    password: 'password123'
                })
            });
            console.log('Login Status:', loginRes.status);
            console.log('Login Body:', await loginRes.text());
            return; // Found the server
        } catch (e) {
            console.log(`Port ${port} failed: ${e.cause ? e.cause.code : e.message}`);
        }
    }
    console.log('Could not find running server on common ports.');
}

main();
