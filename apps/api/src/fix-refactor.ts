
import fs from 'fs';
import path from 'path';

const files = [
    'tables.ts',
    'stock-import.ts',
    'recipe-ai.ts',
    'purchases.ts',
    'purchase-lists.ts',
    'portioning.ts',
    'pdv-payments.ts',
    'pdv-orders.ts',
    'menu-analysis.ts',
    'goals.ts',
    'dashboard.ts',
    'customers.ts',
    'cash-session.ts',
    'alerts.ts',
    'cmv.ts', // Included to be safe
    'stock.ts' // Included to be safe
];

const dir = path.join(process.cwd(), 'src/routes');

files.forEach(file => {
    const filePath = path.join(dir, file);
    if (fs.existsSync(filePath)) {
        console.log(`Processing ${file}...`);
        let content = fs.readFileSync(filePath, 'utf-8');

        // Replace imports
        // Pattern: import { ..., requireRestaurant, ... } from '../middleware/auth'
        // Simple replace first
        content = content.replace(/requireRestaurant/g, 'requireCostCenter');

        // Replace request.user.restaurantId -> request.user.costCenterId
        content = content.replace(/request\.user(\??)\.restaurantId/g, 'request.user$1.costCenterId');
        content = content.replace(/request\.user(!?)\.restaurantId/g, 'request.user$1.costCenterId');

        // Replace prisma.restaurant -> prisma.costCenter
        content = content.replace(/prisma\.restaurant\./g, 'prisma.costCenter.');

        fs.writeFileSync(filePath, content);
    } else {
        console.log(`Skipping ${file} (not found)`);
    }
});

console.log('Done!');
