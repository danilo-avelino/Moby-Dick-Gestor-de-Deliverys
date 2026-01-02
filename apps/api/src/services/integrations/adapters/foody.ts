// Foody Delivery Sales Adapter
// Documentation: foodydelivery.com/developers
// Uses Foody App API for Order Management

import { SalesIntegrationAdapter, registerAdapter } from '../base-adapter';
import { prisma } from 'database';
import { integrationInboxService } from '../integration-inbox.service';
import {
    IntegrationConfig,
    NormalizedOrder,
    OrderStatus,
    IntegrationInbox
} from '../types';

interface FoodyOrder {
    id: string | number;
    uid?: string;
    visualId?: string;
    restaurantId?: number;
    clientId?: number;
    status: FoodyOrderStatus;
    orderTotal: number;
    date: string; // ISO string
    platform?: string;
    paymentMethod?: string;
    isDelivery?: boolean;
    customer: {
        id?: number;
        customerName: string;
        customerPhone: string;
        addresses?: any[];
    };
    orderDetails?: string;
    items?: Array<{
        name: string;
        quantity: number;
        price: number;
        subItems?: Array<{
            name: string;
            quantity: number;
            price: number;
        }>;
        observation?: string;
    }>;
    deliveryPoint?: {
        street?: string;
        houseNumber?: string;
        neighborhood?: string;
        city?: string;
        postalCode?: string;
        complement?: string;
    };
    deliveryFee?: number;
    discount?: number;
    notes?: string;
    statusHistory?: Array<{
        status: FoodyOrderStatus;
        date: string;
    }>;
    readyDate?: string;
    dispatchDate?: string;
    collectedDate?: string; // Added field
    deliveryDate?: string;
}

type FoodyOrderStatus =
    | 'Pending'
    | 'Accepted'
    | 'Visualized'
    | 'Dispatching'
    | 'Dispatched'
    | 'Delivered'
    | 'Cancelled'
    | 'closed'
    | 'cancelled';

export class FoodyAdapter extends SalesIntegrationAdapter {
    private readonly API_URL = 'https://app.foodydelivery.com/rest/1.2';

    constructor(config: IntegrationConfig) {
        super(config);
    }

    getPlatformName(): string {
        return 'Foody Delivery';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        if (!this.credentials.apiToken) {
            throw new Error('Foody API token is required');
        }
    }

    async refreshToken(): Promise<void> {
        // Token doesn't expire for Foody (static token)
    }

    isTokenValid(): boolean {
        return !!this.credentials.apiToken;
    }

    async testConnection(): Promise<boolean> {
        try {
            // Test connection by fetching orders for today using full ISO strings
            const today = new Date().toISOString().split('T')[0];
            const startDate = `${today}T00:00:00-03:00`;
            const endDate = `${today}T23:59:59-03:00`;
            await this.fetchOrdersBatch(startDate, endDate);
            return true;
        } catch (e) {
            console.error('Foody connection test failed:', e);
            return false;
        }
    }

    protected async makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        const url = `${this.getBaseUrl()}${endpoint}`;

        const response = await fetch(url, {
            method,
            headers: {
                'Authorization': `${this.credentials.apiToken}`,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Foody API error: ${response.status} - ${errorText}`);
        }

        if (response.status === 204) {
            return {} as T;
        }

        return response.json();
    }

    async fetchOrders(since?: Date): Promise<NormalizedOrder[]> {
        // Fetch and return - mostly for legacy sync compatibility
        const startDate = since ? since.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const endDate = new Date().toISOString().split('T')[0];

        const foodyOrders = await this.fetchOrdersBatch(startDate, endDate);
        return foodyOrders.map(order => this.normalizeOrder(order));
    }

    async ingestOrders(since?: Date): Promise<number> {
        const now = new Date();
        const startStr = since
            ? `${since.toISOString().split('T')[0]}T00:00:00-03:00`
            : `${now.toISOString().split('T')[0]}T00:00:00-03:00`;

        const endStr = `${now.toISOString().split('T')[0]}T23:59:59-03:00`;

        const orders = await this.fetchOrdersBatch(startStr, endStr);

        if (this.config.integrationId) {
            for (const order of orders) {
                await integrationInboxService.logIngestion({
                    integrationId: this.config.integrationId,
                    source: 'foody',
                    event: 'order.pull',
                    externalId: order.id.toString(),
                    rawPayload: order
                });
            }
        }

        return orders.length;
    }

    async processPayload(inboxItem: IntegrationInbox): Promise<void> {
        const foodyOrder = inboxItem.rawPayload as any as FoodyOrder;
        const normalized = this.normalizeOrder(foodyOrder);
        const costCenterId = this.config.costCenterId;

        if (!costCenterId) throw new Error('Cost Center ID is required for processing Foody orders');

        const now = new Date();
        const orderIdStr = (foodyOrder.id || foodyOrder.uid || inboxItem.externalId || Math.random()).toString();

        // 2. Extract timestamps for analysis
        let readyAt: Date | null = foodyOrder.readyDate ? new Date(foodyOrder.readyDate) : null;
        // dispatchDate is usually "Ready for Pickup", collectedDate is "Driver Picked Up"
        let pickedUpAt: Date | null = foodyOrder.collectedDate ? new Date(foodyOrder.collectedDate) : (foodyOrder.dispatchDate ? new Date(foodyOrder.dispatchDate) : null);
        let deliveredAt: Date | null = foodyOrder.deliveryDate ? new Date(foodyOrder.deliveryDate) : null;
        const arrivedAt = new Date(foodyOrder.date);

        // Try history if top-level fields are missing
        if (foodyOrder.statusHistory) {
            // Sort history by date to ensure we get the first occurrence of each status
            const sortedHistory = [...foodyOrder.statusHistory].sort((a, b) =>
                new Date(a.date).getTime() - new Date(b.date).getTime()
            );

            for (const h of sortedHistory) {
                const s = h.status.toLowerCase();
                const d = new Date(h.date);

                // Dispatching in Foody indicates the kitchen is done (Ready)
                if ((s === 'dispatching' || s === 'ready') && !readyAt) {
                    readyAt = d;
                }
                // Dispatched indicates rider collection (Picked Up)
                if ((s === 'dispatched' || s === 'pickedup' || s === 'collected') && !pickedUpAt) {
                    pickedUpAt = d;
                }
                // Delivered indicates completion
                if ((s === 'delivered' || s === 'closed') && !deliveredAt) {
                    deliveredAt = d;
                }
            }
        }

        // Fallbacks and sanity checks
        // If readyAt is still null but we have pickedUpAt, assume it was ready then
        if (!readyAt && pickedUpAt) readyAt = pickedUpAt;

        // Calculate times in minutes
        let prepTime = readyAt ? (readyAt.getTime() - arrivedAt.getTime()) / 60000 : null;
        let pickupTime = (readyAt && pickedUpAt) ? (pickedUpAt.getTime() - readyAt.getTime()) / 60000 : null;
        let deliveryTime = (pickedUpAt && deliveredAt) ? (deliveredAt.getTime() - pickedUpAt.getTime()) / 60000 : null;
        let totalTime = deliveredAt ? (deliveredAt.getTime() - arrivedAt.getTime()) / 60000 : null;

        // Invalid order logic: if prep and pickup are zero, exclude from metrics
        if (prepTime === 0 && pickupTime === 0) {
            prepTime = null;
            pickupTime = null;
            deliveryTime = null;
            totalTime = null;

            // Also nullify dates for total consistency in metrics
            readyAt = null;
            pickedUpAt = null;
            deliveredAt = null;
        }

        // 1. Maintain legacy Order table for compatibility
        await prisma.order.upsert({
            where: {
                costCenterId_externalId_logisticsProvider: {
                    costCenterId,
                    externalId: normalized.externalId,
                    logisticsProvider: 'FOODY'
                }
            },
            update: {
                orderValue: normalized.total.total,
                metadata: foodyOrder as any,
                updatedAt: now,
                readyDatetime: readyAt || null,
                outForDeliveryDatetime: pickedUpAt || null,
                deliveredDatetime: deliveredAt || null,
                prepTime,
                pickupTime,
                deliveryTime,
                totalTime
            },
            create: {
                costCenterId,
                organizationId: this.config.organizationId,
                integrationId: this.config.integrationId,
                externalId: normalized.externalId,
                logisticsProvider: 'FOODY',
                orderDatetime: arrivedAt,
                customerName: normalized.customer.name,
                deliveryAddress: normalized.delivery ? `${normalized.delivery.address.street}, ${normalized.delivery.address.number}` : undefined,
                orderValue: normalized.total.total,
                metadata: foodyOrder as any,
                readyDatetime: readyAt || null,
                outForDeliveryDatetime: pickedUpAt || null,
                deliveredDatetime: deliveredAt || null,
                prepTime,
                pickupTime,
                deliveryTime,
                totalTime
            }
        });

        // 2. Sync to PdvOrder (Active System)
        const pdvStatus = this.mapToPdvStatus(normalized.status);

        const existingPdvOrder = await prisma.pdvOrder.findUnique({
            where: { costCenterId_code: { costCenterId, code: normalized.externalId } }
        });

        const shouldCreateHistory = !existingPdvOrder || existingPdvOrder.status !== pdvStatus;

        await prisma.pdvOrder.upsert({
            where: {
                costCenterId_code: {
                    costCenterId,
                    code: normalized.externalId
                }
            },
            update: {
                status: pdvStatus,
                customerName: normalized.customer.name,
                customerPhone: normalized.customer.phone,
                total: normalized.total.total,
                subtotal: normalized.total.subtotal,
                deliveryFee: normalized.total.deliveryFee,
                discount: normalized.total.discount,
                readyAt: readyAt || null,
                deliveredAt: deliveredAt || null,
                updatedAt: now,
                metadata: foodyOrder as any,
                // Only create history if status changed
                statusHistory: shouldCreateHistory ? {
                    create: {
                        toStatus: pdvStatus,
                        fromStatus: existingPdvOrder?.status,
                        createdAt: now
                    }
                } : undefined
            },
            create: {
                costCenterId,
                organizationId: this.config.organizationId,
                code: normalized.externalId, // External ID as code
                orderType: 'DELIVERY', // Hardcoded as per schema
                salesChannel: 'APP_PROPRIO', // Using APP_PROPRIO for Foody
                status: pdvStatus,
                customerName: normalized.customer.name,
                customerPhone: normalized.customer.phone,
                total: normalized.total.total,
                subtotal: normalized.total.subtotal,
                deliveryFee: normalized.total.deliveryFee,
                discount: normalized.total.discount,
                createdAt: arrivedAt,
                readyAt: readyAt || null,
                deliveredAt: deliveredAt || null,
                metadata: foodyOrder as any,
                statusHistory: {
                    create: {
                        toStatus: pdvStatus,
                        createdAt: now
                    }
                }
            }
        });

        const localHour = (arrivedAt.getUTCHours() - 3 + 24) % 24;
        const shift = localHour < 16 ? 'DAY' : 'NIGHT';

        // Workday (adjust for 3am late night shift if needed, but here we stay simple)
        const workdayVal = new Date(arrivedAt.getTime() - 3 * 3600 * 1000);
        workdayVal.setUTCHours(0, 0, 0, 0);

        await prisma.workTimeOrder.upsert({
            where: {
                restaurantId_provider_providerOrderId: {
                    restaurantId: costCenterId,
                    provider: 'FOODY',
                    providerOrderId: orderIdStr
                }
            },
            create: {
                restaurantId: costCenterId,
                provider: 'FOODY',
                providerOrderId: orderIdStr,
                orderDate: arrivedAt,
                arrivedAt,
                readyAt: readyAt || null,
                pickedUpAt: pickedUpAt || null,
                deliveredAt: deliveredAt || null,
                shift,
                workday: workdayVal,
                rawPayload: foodyOrder as any
            },
            update: {
                readyAt: readyAt || null,
                pickedUpAt: pickedUpAt || null,
                deliveredAt: deliveredAt || null,
                rawPayload: foodyOrder as any
            }
        });

        // Mark inbox item as processed
        await integrationInboxService.markProcessed(inboxItem.id, normalized);
    }

    private mapToPdvStatus(status: OrderStatus): any {
        // PdvOrderStatus: NOVO, EM_PREPARO, PRONTO, EM_ENTREGA, CONCLUIDO, CANCELADO
        switch (status) {
            case 'PENDING': return 'NOVO';
            case 'ACCEPTED': return 'EM_PREPARO';
            case 'PREPARING': return 'EM_PREPARO';
            case 'READY': return 'PRONTO';
            case 'DISPATCHED': return 'EM_ENTREGA';
            case 'DELIVERED': return 'CONCLUIDO';
            case 'CANCELLED': return 'CANCELADO';
            default: return 'NOVO';
        }
    }

    async fetchOrdersBatch(startDate: string, endDate: string): Promise<FoodyOrder[]> {
        // Endpoint: /orders?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
        return this.makeRequest<FoodyOrder[]>('GET', `/orders?startDate=${startDate}&endDate=${endDate}`);
    }

    async getOrderDetails(orderId: string): Promise<NormalizedOrder> {
        try {
            const order = await this.makeRequest<FoodyOrder>('GET', `/orders/${orderId}`);
            return this.normalizeOrder(order);
        } catch (e) {
            throw new Error(`Could not fetch details for order ${orderId}`);
        }
    }

    async confirmOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/confirm`);
    }

    async rejectOrder(orderId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/reject`, { reason });
    }

    async markOrderReady(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/ready`);
    }

    async dispatchOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/dispatch`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<void> {
        await this.makeRequest('POST', `/orders/${orderId}/cancel`, { reason });
    }

    protected normalizeOrder(foodyOrder: FoodyOrder): NormalizedOrder {
        const orderId = (foodyOrder.id || foodyOrder.uid || Math.random()).toString();

        // Handle items vs orderDetails string
        let normalizedItems = foodyOrder.items?.map(item => ({
            externalId: 'unknown',
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
            subItems: item.subItems?.map(sub => ({
                name: sub.name,
                quantity: sub.quantity,
                price: sub.price
            })) || [],
            observations: item.observation
        })) || [];

        if (normalizedItems.length === 0 && foodyOrder.orderDetails) {
            normalizedItems = [{
                externalId: 'summary',
                name: foodyOrder.orderDetails.substring(0, 50).replace(/\n/g, ' ') + '...',
                quantity: 1,
                unitPrice: foodyOrder.orderTotal || 0,
                totalPrice: foodyOrder.orderTotal || 0,
                subItems: [],
                observations: foodyOrder.orderDetails
            }];
        }

        return {
            id: (foodyOrder.visualId || orderId).toString(),
            externalId: orderId,
            platform: 'FOODY',
            createdAt: new Date(foodyOrder.date),
            status: this.mapStatus(foodyOrder.status),
            type: foodyOrder.isDelivery ? 'DELIVERY' : 'TAKEOUT',

            customer: {
                id: (foodyOrder.customer.id || foodyOrder.clientId || 0).toString(),
                name: foodyOrder.customer.customerName || 'Cliente Foody',
                phone: foodyOrder.customer.customerPhone || '',
            },

            items: normalizedItems,

            total: {
                subtotal: (foodyOrder.orderTotal || 0) - (foodyOrder.deliveryFee || 0) + (foodyOrder.discount || 0),
                deliveryFee: foodyOrder.deliveryFee || 0,
                discount: foodyOrder.discount || 0,
                total: foodyOrder.orderTotal || 0,
            },

            payment: {
                method: this.mapPaymentMethod(foodyOrder.paymentMethod || 'UNKNOWN'),
                total: foodyOrder.orderTotal || 0,
                status: 'PENDING',
                isPrepaid: foodyOrder.paymentMethod?.toLowerCase().includes('online') || false
            },

            delivery: foodyOrder.isDelivery ? {
                address: {
                    street: foodyOrder.deliveryPoint?.street || '',
                    number: foodyOrder.deliveryPoint?.houseNumber || '',
                    neighborhood: foodyOrder.deliveryPoint?.neighborhood || '',
                    city: foodyOrder.deliveryPoint?.city || '',
                    state: '',
                    zipCode: foodyOrder.deliveryPoint?.postalCode || '',
                    complement: foodyOrder.deliveryPoint?.complement,
                },
                estimatedTime: undefined
            } : undefined,

            observations: foodyOrder.notes || foodyOrder.orderDetails
        };
    }

    protected mapStatusToPlatform(status: OrderStatus): string {
        switch (status) {
            case 'PENDING': return 'Pending';
            case 'ACCEPTED': return 'Accepted';
            case 'PREPARING': return 'Accepted';
            case 'READY': return 'Dispatching';
            case 'DISPATCHED': return 'Dispatched';
            case 'DELIVERED': return 'Delivered';
            case 'CANCELLED': return 'Cancelled';
            default: return 'Pending';
        }
    }

    private mapStatus(foodyStatus: FoodyOrderStatus): OrderStatus {
        const map: Record<string, OrderStatus> = {
            'Pending': 'PENDING',
            'Visualized': 'PENDING',
            'Accepted': 'ACCEPTED',
            'Dispatching': 'READY',
            'Dispatched': 'DISPATCHED',
            'Delivered': 'DELIVERED',
            'Cancelled': 'CANCELLED',
            'closed': 'DELIVERED',
            'cancelled': 'CANCELLED'
        };
        const s = foodyStatus as string;
        return map[s] || (s.toLowerCase() === 'closed' ? 'DELIVERED' : 'PENDING');
    }

    private mapPaymentMethod(method: string): string {
        if (!method) return 'UNKNOWN';
        const lower = method.toLowerCase();
        if (lower.includes('dinheiro')) return 'CASH';
        if (lower.includes('crédito')) return 'CREDIT_CARD';
        if (lower.includes('débito')) return 'DEBIT_CARD';
        if (lower.includes('pix')) return 'PIX';
        if (lower.includes('online')) return 'ONLINE';
        return 'OTHER';
    }
}

// Register the adapter
registerAdapter('foody', FoodyAdapter);
