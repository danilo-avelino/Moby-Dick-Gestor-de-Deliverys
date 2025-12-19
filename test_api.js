
const VALID_EMAIL = 'danilocaioavelino@gmail.com';
const VALID_PASS = 'admin123';

async function main() {
    try {
        // 1. Login
        console.log('Logging in...');
        const loginRes = await fetch('http://localhost:3001/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: VALID_EMAIL, password: VALID_PASS })
        });

        if (!loginRes.ok) {
            console.error('Login Failed:', await loginRes.text());
            return;
        }

        const responseBody = await loginRes.json();
        const token = responseBody.data.accessToken;
        console.log('Login Success. Token acquired:', token ? 'YES' : 'NO');
        if (!token) {
            console.error('No access token in response:', JSON.stringify(responseBody));
            return;
        }

        // 2. List Sectors
        console.log('Listing Sectors...');
        const listRes = await fetch('http://localhost:3001/schedules/sectors', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!listRes.ok) {
            console.error('List Failed:', await listRes.text());
        } else {
            const sectors = await listRes.json();
            console.log('Sectors Found:', sectors.length);
            console.log(JSON.stringify(sectors, null, 2));
        }

        // 3. Create Sector
        console.log('Creating Test Sector...');
        const createRes = await fetch('http://localhost:3001/schedules/sectors', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Test Sector API ' + Date.now(),
                minStaffByWeekday: { "0": 2, "1": 2, "2": 2, "3": 2, "4": 2, "5": 2, "6": 2 }
            })
        });

        if (!createRes.ok) {
            console.error('Create Failed:', await createRes.text());
        } else {
            const created = await createRes.json();
            console.log('Sector Created:', created);
        }

    } catch (err) {
        console.error('Script Error:', err);
    }
}

main();
