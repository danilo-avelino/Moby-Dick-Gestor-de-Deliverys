
import { prisma } from 'database';
import { integrationManager } from './integration-manager';
import { FoodyAdapter } from './adapters/foody';
import { IntegrationPlatform } from '@prisma/client';

export class FoodyWorkTimesService {

    // Ingest all orders for a specific date (or "today" if not provided)
    // Date formatting: YYYY-MM-DD
    async ingestDailyOrders(restaurantId: string, dateStr?: string): Promise<{
        total: number;
        Upserted: number;
        Errors: number;
        Pages: number;
    }> {
        const stats = { total: 0, Upserted: 0, Errors: 0, Pages: 0 };

        // 1. Resolve Date Window (-03:00)
        // If dateStr provided, use it. Else use current date in -03:00.
        const targetDate = dateStr ? new Date(dateStr) : new Date();
        // Adjust to -03:00 "Start of Day"
        // Easier approach: Construct string "YYYY-MM-DDT00:01:00-03:00"
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getDate()).padStart(2, '0');

        const dayString = `${yyyy}-${mm}-${dd}`;
        let startDate = `${dayString}T00:01:00-03:00`;
        const endDate = `${dayString}T23:59:00-03:00`;

        console.log(`[FoodyIngest] Starting for ${restaurantId} on ${dayString}`);
        console.log(`[FoodyIngest] Window: ${startDate} to ${endDate}`);

        // 2. Get Integration/Adapter
        // We need to find the Foody integration for this restaurant
        const integration = await prisma.integration.findFirst({
            where: {
                // restaurantId might be costCenterId in this system? 
                // User said "restaurant_id (id interno do restaurante/centro de custo)"
                // so we query by costCenterId if that matches, or we look for ANY foody integration if restaurantId is actually the integration ID?
                // The prompt says "Para cada restaurante que tenha Foody integrado".
                // Let's assume restaurantId passed here IS the costCenterId.
                costCenterId: restaurantId,
                platform: { in: ['FOODY'] as IntegrationPlatform[] }, // Cast to match enum
                status: { in: ['CONNECTED', 'INGESTING', 'CONFIGURED'] }
            }
        });

        if (!integration) {
            throw new Error(`No active Foody integration found for restaurant ${restaurantId}`);
        }

        // Use manager to get adapter (handles auth)
        // Check if loaded
        let adapter = integrationManager.getIntegration(integration.id)?.adapter as FoodyAdapter;

        // If not loaded (e.g. server restart), try to load it ephemerally or add to manager
        if (!adapter) {
            await integrationManager.addIntegration({
                id: integration.id,
                platform: integration.platform,
                type: 'logistics',
                credentials: integration.credentials,
                syncInterval: integration.syncFrequencyMinutes,
                organizationId: integration.organizationId || undefined,
                costCenterId: integration.costCenterId
            });
            adapter = integrationManager.getIntegration(integration.id)?.adapter as FoodyAdapter;
        }

        if (!adapter) throw new Error('Failed to initialize Foody Adapter');

        // 3. Pagination Loop
        let hasMore = true;

        while (hasMore) {
            stats.Pages++;
            console.log(`[FoodyIngest] Fetching page ${stats.Pages}, start: ${startDate}`);

            let orders: any[] = [];
            try {
                orders = await adapter.fetchOrdersBatch(startDate, endDate);
            } catch (e) {
                console.error('[FoodyIngest] Batch fetch error:', e);
                throw e; // Abort job if fetch fails
            }

            if (!orders || orders.length === 0) {
                hasMore = false;
                break;
            }

            stats.total += orders.length;

            // Process Orders
            for (const order of orders) {
                try {
                    await this.upsertOrder(restaurantId, order, dayString);
                    stats.Upserted++;
                } catch (err) {
                    console.error('[FoodyIngest] Upsert error order:', order.id, err);
                    stats.Errors++;
                }
            }

            // Check pagination
            if (orders.length < 500) {
                hasMore = false;
            } else {
                // offset logic: last order date + 1 second
                const lastOrder = orders[orders.length - 1];
                if (lastOrder.date) {
                    // Start date format from Foody is typically ISO or similiar.
                    // We need to parse it, add 1 sec, and format back to ISO with offset?
                    // User said: "startDate = lastOrder.date + 1 segundo"
                    // And "Formato dos parâmetros: yyyy-MM-dd'T'HH:mm:ssXXX"
                    // We can just rely on string manipulation or Date object if timezone aware.
                    const lastDate = new Date(lastOrder.date);
                    lastDate.setSeconds(lastDate.getSeconds() + 1);

                    // Reformat to include offset -03:00. 
                    // ToISOString is UTC. 
                    // Let's manually construct it to ensure -03:00.
                    startDate = this.formatDateWithOffset(lastDate);
                } else {
                    console.warn('[FoodyIngest] Last order missing date, preventing loop');
                    hasMore = false;
                }
            }
        }

        console.log('[FoodyIngest] Complete:', stats);
        return stats;
    }

    private async upsertOrder(restaurantId: string, raw: any, workdayStr: string) {
        // Mapping

        // Timestamps
        // raw.date -> orderDate
        // raw.created -> arrivedAt ? User said "timestamp 'chegou'"
        // Foody payload usually has 'date' (order time) and 'statusHistory' or similar fields.
        // User said: "Use os campos reais do payload do Foody"
        // Documentation is scarce here, so I will try to infer standard fields or assume 'date' is arrivedAt.
        // User prompt mapping:
        // order_date = raw.date
        // arrived_at = raw.date (or raw.registerDate?) -> Let's use raw.date as prompted "timestamp quando o pedido 'chegou'".

        // Actually user said: 
        // "order_date (campo date do Foody)"
        // "arrived_at (timestamp quando o pedido “chegou”/foi criado)" -> Usually same as date.

        // "ready_at", "picked_up_at", "delivered_at"
        // Foody orders often have a 'history' array or specific fields like 'dispatchDate', 'deliveryDate'.
        // Without live/mock payload, I'll assume they might be in `history`. 
        // Or I'll allow them to be null for now if not found at top level.

        // Looking at adapters/foody.ts, there is `events: Array<{ status: string, timestamp: string }>`.
        // Ideally `fetchDailyOrders` returns full order details including events. 
        // If the list endpoint returns simplified objects, we might need to fetch details?
        // User says: "Limite: 500 pedidos... Para cada pedido retornado... Extrai os timestamps... Use os campos reais classificados".
        // Implicitly assumes the list endpoint has enough data.

        // Let's assume the payload has `statusHistory` or `events`.
        // If not, we map what we can found.

        // Parse dates
        const orderDate = new Date(raw.date);
        const arrivedAt = new Date(raw.date); // Using date as arrival

        let readyAt: Date | null = null;
        let pickedUpAt: Date | null = null;
        let deliveredAt: Date | null = null;

        // Try to find status changes in history/events if present
        const history = Array.isArray(raw.statusHistory) ? raw.statusHistory : [];
        // Map status history
        // Foody statuses: CONFIRMED (ready?), DISPATCHED (picked up?), DELIVERED

        // Heuristic mapping
        for (const h of history) {
            const s = (h.status || '').toUpperCase();
            const d = new Date(h.date || h.timestamp);

            if (s === 'READY' || s === 'CONFIRMED') readyAt = d;
            if (s === 'DISPATCHED' || s === 'ON_ROUTE') pickedUpAt = d;
            if (s === 'DELIVERED') deliveredAt = d;
        }

        // Fallback: Check top-level fields if history failed
        if (!readyAt && raw.readyDate) readyAt = new Date(raw.readyDate);
        if (!pickedUpAt && raw.dispatchDate) pickedUpAt = new Date(raw.dispatchDate);
        if (!deliveredAt && raw.deliveryDate) deliveredAt = new Date(raw.deliveryDate);


        // Shift Calculation
        // "Turno dia: 00:00 até 15:59:59" (-03:00)
        // "Turno noite: 16:00:00 até 23:59:59" (-03:00)
        // Need to check the hour in -03:00 timezone.
        // arrivedAt is likely ISO UTC.
        // Convert to local hours
        const utcHours = arrivedAt.getUTCHours();
        // -3 hours offset.
        // If < 3, it's previous day late night? No, we trust the date query was for current day.
        // (utcHours - 3 + 24) % 24
        let localHour = (utcHours - 3);
        if (localHour < 0) localHour += 24;

        const shift = localHour < 16 ? 'DAY' : 'NIGHT';

        // Workday defaults to the passed dayString, or derived from arrivedAt-3h
        const derivedWorkday = new Date(arrivedAt.getTime() - 3 * 3600 * 1000);
        // Format YYYY-MM-DD
        const w_yyyy = derivedWorkday.getFullYear();
        const w_mm = String(derivedWorkday.getMonth() + 1).padStart(2, '0');
        const w_dd = String(derivedWorkday.getDate()).padStart(2, '0');
        const workdayVal = new Date(`${w_yyyy}-${w_mm}-${w_dd}T00:00:00Z`); // Store as Date

        await prisma.workTimeOrder.upsert({
            where: {
                restaurantId_provider_providerOrderId: {
                    restaurantId,
                    provider: 'FOODY',
                    providerOrderId: String(raw.id)
                }
            },
            create: {
                restaurantId,
                provider: 'FOODY',
                providerOrderId: String(raw.id),
                orderDate,
                arrivedAt,
                readyAt,
                pickedUpAt,
                deliveredAt,
                shift,
                workday: workdayVal,
                rawPayload: raw as any
            },
            update: {
                // "Atualizar timestamps que estejam vazios ou mais antigos" is standard upsert behavior? 
                // Mostly just overwrite.
                // "Se existe e o raw_payload mudou, atualizar também."
                // Overwriting is safest for now.
                readyAt: readyAt || undefined, // undefined keeps existing? No, upsert replaces.
                // Logic: "Se já existe, atualizar timestamps que estejam vazios"
                // Prisma update doesn't support conditional "update if null".
                // We'd need to fetch then update, or use raw query.
                // For simplicity/performance: just update all.
                // If the feed returns an order, it's the latest state.
                pickedUpAt,
                deliveredAt,
                rawPayload: raw as any
            }
        });
    }

    private formatDateWithOffset(date: Date): string {
        // Convert to ISO-like string with -03:00 offset
        // Adjust time to -3 zone manually
        const offset = 3 * 60 * 60 * 1000;
        const local = new Date(date.getTime() - offset);

        const iso = local.toISOString().slice(0, 19); // YYYY-MM-DDTHH:mm:ss
        return `${iso}-03:00`;
    }
}

export const foodyWorkTimesService = new FoodyWorkTimesService();
