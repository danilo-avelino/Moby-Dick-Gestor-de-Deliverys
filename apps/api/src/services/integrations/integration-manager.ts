// Integration Manager - Central service to manage all integrations

import { prisma } from 'database';
import { integrationInboxService } from './integration-inbox.service';
import {
    BaseIntegrationAdapter,
    SalesIntegrationAdapter,
    LogisticsIntegrationAdapter,
    createAdapter
} from './base-adapter';
import {
    IntegrationConfig,
    IntegrationType,
    NormalizedOrder,
    DeliveryRequest,
    DeliveryQuote,
    DeliveryTracking
} from './types';

// Import adapters to ensure they register themselves
import './adapters/ifood';
import './adapters/99food';
import './adapters/saipos';
import './adapters/open-delivery';
import './adapters/foody';
import './adapters/agilizone';

interface ManagedIntegration {
    id: string;
    platform: string;
    type: IntegrationType;
    adapter: BaseIntegrationAdapter;
    lastSyncAt?: Date;
    syncInterval: number; // minutes
}

export class IntegrationManager {
    private integrations: Map<string, ManagedIntegration> = new Map();
    private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        // Don't auto-load - call init() after server startup
    }

    // Initialize the manager - call after server is ready
    async init(): Promise<void> {
        await this.loadIntegrations();
    }

    // Load all active integrations from database
    async loadIntegrations(): Promise<void> {
        try {
            const dbIntegrations = await prisma.integration.findMany({
                where: { status: 'CONNECTED' }, // Updated status enum
            });

            for (const integration of dbIntegrations) {
                await this.addIntegration({
                    id: integration.id,
                    platform: integration.platform,
                    type: this.getIntegrationType(integration.platform),
                    credentials: integration.credentials as any,
                    syncInterval: integration.syncFrequencyMinutes,
                    organizationId: integration.organizationId || undefined,
                    costCenterId: integration.costCenterId,
                });
            }

            console.log(`Loaded ${this.integrations.size} active integrations`);
        } catch (error) {
            console.error('Failed to load integrations:', error);
        }
    }

    // Add a new integration
    async addIntegration(config: {
        id: string;
        platform: string;
        type: IntegrationType;
        credentials: any;
        syncInterval: number;
        organizationId?: string;
        costCenterId: string;
    }): Promise<boolean> {
        try {
            const adapterConfig: IntegrationConfig = {
                platform: config.platform,
                type: config.type,
                credentials: config.credentials,
                sandboxMode: process.env.NODE_ENV !== 'production',
                integrationId: config.id,
                organizationId: config.organizationId,
                costCenterId: config.costCenterId,
            };

            const adapter = createAdapter(adapterConfig);
            await adapter.authenticate();

            const managed: ManagedIntegration = {
                id: config.id,
                platform: config.platform,
                type: config.type,
                adapter,
                syncInterval: config.syncInterval,
            };

            this.integrations.set(config.id, managed);

            // Start sync polling for sales integrations
            if (config.type === 'sales') {
                this.startSyncPolling(config.id);
            }

            return true;
        } catch (error) {
            console.error(`Failed to add integration ${config.platform}:`, error);
            // Don't fail the whole load process, just this one
            // Maybe update status to DEGRADED?
            return false;
        }
    }

    // Remove an integration
    removeIntegration(integrationId: string): boolean {
        this.stopSyncPolling(integrationId);
        return this.integrations.delete(integrationId);
    }

    // Get integration by ID
    getIntegration(integrationId: string): ManagedIntegration | undefined {
        return this.integrations.get(integrationId);
    }

    // Get all integrations for a restaurant
    getIntegrationsByType(type: IntegrationType): ManagedIntegration[] {
        return Array.from(this.integrations.values())
            .filter(i => i.type === type);
    }

    // --- Sales Operations ---

    async fetchOrders(integrationId: string, since?: Date): Promise<NormalizedOrder[]> {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'sales') {
            throw new Error('Invalid sales integration');
        }

        const adapter = integration.adapter as SalesIntegrationAdapter;
        return adapter.fetchOrders(since);
    }

    async confirmOrder(integrationId: string, orderId: string): Promise<void> {
        const integration = this.integrations.get(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = integration.adapter as SalesIntegrationAdapter;
        await adapter.confirmOrder(orderId);
    }

    async rejectOrder(integrationId: string, orderId: string, reason?: string): Promise<void> {
        const integration = this.integrations.get(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = integration.adapter as SalesIntegrationAdapter;
        await adapter.rejectOrder(orderId, reason);
    }

    async markOrderReady(integrationId: string, orderId: string): Promise<void> {
        const integration = this.integrations.get(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = integration.adapter as SalesIntegrationAdapter;
        await adapter.markOrderReady(orderId);
    }

    async dispatchOrder(integrationId: string, orderId: string): Promise<void> {
        const integration = this.integrations.get(integrationId);
        if (!integration) throw new Error('Integration not found');

        const adapter = integration.adapter as SalesIntegrationAdapter;
        await adapter.dispatchOrder(orderId);
    }

    // --- Logistics Operations ---

    async getDeliveryQuote(integrationId: string, request: DeliveryRequest): Promise<DeliveryQuote> {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'logistics') {
            throw new Error('Invalid logistics integration');
        }

        const adapter = integration.adapter as LogisticsIntegrationAdapter;
        return adapter.getDeliveryQuote(request);
    }

    async requestDelivery(integrationId: string, request: DeliveryRequest): Promise<string> {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'logistics') {
            throw new Error('Invalid logistics integration');
        }

        const adapter = integration.adapter as LogisticsIntegrationAdapter;
        return adapter.requestDelivery(request);
    }

    async cancelDelivery(integrationId: string, deliveryId: string, reason?: string): Promise<void> {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'logistics') {
            throw new Error('Invalid logistics integration');
        }

        const adapter = integration.adapter as LogisticsIntegrationAdapter;
        await adapter.cancelDelivery(deliveryId, reason);
    }

    async getDeliveryTracking(integrationId: string, deliveryId: string): Promise<DeliveryTracking> {
        const integration = this.integrations.get(integrationId);
        if (!integration || integration.type !== 'logistics') {
            throw new Error('Invalid logistics integration');
        }

        const adapter = integration.adapter as LogisticsIntegrationAdapter;
        return adapter.getDeliveryTracking(deliveryId);
    }

    // --- Sync Management ---

    private startSyncPolling(integrationId: string): void {
        const integration = this.integrations.get(integrationId);
        if (!integration) return;

        const interval = setInterval(async () => {
            try {
                await this.syncOrders(integrationId);
            } catch (error) {
                console.error(`Sync failed for ${integrationId}:`, error);
            }
        }, integration.syncInterval * 60 * 1000);

        this.syncIntervals.set(integrationId, interval);
    }

    private stopSyncPolling(integrationId: string): void {
        const interval = this.syncIntervals.get(integrationId);
        if (interval) {
            clearInterval(interval);
            this.syncIntervals.delete(integrationId);
        }
    }

    async syncOrders(integrationId: string): Promise<number> {
        const integration = this.integrations.get(integrationId);
        if (!integration) return 0;

        const since = integration.lastSyncAt || new Date(Date.now() - 24 * 60 * 60 * 1000);
        const orders = await this.fetchOrders(integrationId, since);

        // Update last sync time
        integration.lastSyncAt = new Date();

        // Log sync
        await prisma.syncLog.create({
            data: {
                integrationId,
                type: 'FULL',
                status: 'SUCCESS',
                itemsProcessed: orders.length,
                startedAt: since,
                completedAt: new Date(),
            },
        });

        console.log(`Synced ${orders.length} orders from ${integration.platform}`);
        return orders.length;
    }

    async manualSync(integrationId: string): Promise<number> {
        const managed = this.integrations.get(integrationId);
        if (!managed) {
            throw new Error('Integration not active');
        }

        if (managed.type === 'sales') {
            const adapter = managed.adapter as SalesIntegrationAdapter;

            // Try ingestOrders first if available
            if (adapter.ingestOrders) {
                const count = await adapter.ingestOrders();
                // Process pending items immediately
                const pending = await integrationInboxService.getPendingItems(integrationId);
                for (const item of pending) {
                    try {
                        await adapter.processPayload(item);
                    } catch (err) {
                        console.error(`Failed to process item ${item.id}`, err);
                        await integrationInboxService.markFailed(item.id, (err as Error).message);
                    }
                }
                return count;
            } else {
                // Fallback to legacy
                const orders = await adapter.fetchOrders();
                return orders.length;
            }
        }
        return 0;
    }

    async reprocessInboxItem(itemId: string): Promise<boolean> {
        const item = await prisma.integrationInbox.findUnique({
            where: { id: itemId },
            include: { integration: true }
        });

        if (!item || !item.integration) throw new Error('Item or Integration not found');

        let adapter = this.integrations.get(item.integrationId)?.adapter;

        if (!adapter) {
            const config: IntegrationConfig = {
                platform: item.integration.platform,
                type: this.getIntegrationType(item.integration.platform),
                credentials: item.integration.credentials as any,
                sandboxMode: process.env.NODE_ENV !== 'production',
                integrationId: item.integration.id,
                organizationId: item.integration.organizationId || undefined,
                costCenterId: item.integration.costCenterId,
            };
            adapter = createAdapter(config);
            try {
                await adapter.authenticate();
            } catch (e) {
                console.warn("Auth failed during reprocess, continuing if offline processing possible", e);
            }
        }

        await adapter.processPayload(item);
        return true;
    }

    // --- Helpers ---

    private getIntegrationType(platform: string): IntegrationType {
        const logisticsplatforms = ['foody', 'agilizone', 'saipos_logistics'];
        return logisticsplatforms.includes(platform.toLowerCase()) ? 'logistics' : 'sales';
    }

    // Test connection for an integration
    async testConnection(integrationId: string): Promise<boolean> {
        const integration = this.integrations.get(integrationId);
        if (!integration) return false;
        return integration.adapter.testConnection();
    }

    // Shutdown - clean up all intervals
    shutdown(): void {
        for (const [id] of this.syncIntervals) {
            this.stopSyncPolling(id);
        }
        this.integrations.clear();
    }
}

// Singleton instance
export const integrationManager = new IntegrationManager();
