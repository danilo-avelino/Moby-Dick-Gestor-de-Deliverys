/**
 * Order Normalizer Service
 * Normalizes order data from different logistics providers to a standard format
 */

import { calculateOrderTimes, OrderTimes, OrderTimestamps } from './time-calculator';

export interface NormalizedOrder {
    externalId: string;
    logisticsProvider: string;
    orderDatetime: Date;
    readyDatetime: Date | null;
    outForDeliveryDatetime: Date | null;
    deliveredDatetime: Date | null;
    customerName?: string;
    deliveryAddress?: string;
    orderValue?: number;
    metadata?: Record<string, any>;
}

export interface NormalizedOrderWithTimes extends NormalizedOrder, OrderTimes { }

// Status mappings for different providers
const STATUS_MAPPINGS: Record<string, {
    ready: string[];
    outForDelivery: string[];
    delivered: string[];
}> = {
    AGILIZONE: {
        ready: ['PRONTO', 'READY', 'PREPARED'],
        outForDelivery: ['SAIU_ENTREGA', 'OUT_FOR_DELIVERY', 'DISPATCHED', 'EM_ROTA'],
        delivered: ['ENTREGUE', 'DELIVERED', 'COMPLETED'],
    },
    FOODY: {
        ready: ['ready', 'prepared', 'pronto_para_coleta'],
        outForDelivery: ['dispatched', 'in_transit', 'saiu_entrega'],
        delivered: ['delivered', 'completed', 'entregue'],
    },
    IFOOD: {
        ready: ['READY_TO_PICKUP', 'CONFIRMED'],
        outForDelivery: ['DISPATCHED', 'IN_ROUTE'],
        delivered: ['CONCLUDED', 'DELIVERED'],
    },
    PICKANDGO: {
        ready: ['READY', 'AWAITING_PICKUP'],
        outForDelivery: ['PICKED_UP', 'IN_DELIVERY'],
        delivered: ['DELIVERED', 'COMPLETED'],
    },
    SAIPOS: {
        ready: ['pronto', 'finalizado'],
        outForDelivery: ['em_entrega', 'coletado'],
        delivered: ['entregue', 'concluido'],
    },
};

/**
 * Extract timestamp from order history/events based on status
 */
function findTimestampByStatus(
    events: Array<{ status: string; timestamp: string | Date }> | undefined,
    statusList: string[]
): Date | null {
    if (!events || !Array.isArray(events)) return null;

    const event = events.find(e =>
        statusList.some(s => e.status?.toLowerCase() === s.toLowerCase())
    );

    if (event?.timestamp) {
        return new Date(event.timestamp);
    }
    return null;
}

/**
 * Normalize order from Agilizone format
 */
function normalizeAgilizone(rawOrder: any): NormalizedOrder {
    const statusMapping = STATUS_MAPPINGS.AGILIZONE;

    return {
        externalId: rawOrder.id || rawOrder.orderId || rawOrder.codigo,
        logisticsProvider: 'AGILIZONE',
        orderDatetime: new Date(rawOrder.createdAt || rawOrder.dataHoraPedido || rawOrder.created_at),
        readyDatetime: rawOrder.readyAt ? new Date(rawOrder.readyAt) :
            findTimestampByStatus(rawOrder.historico || rawOrder.events, statusMapping.ready),
        outForDeliveryDatetime: rawOrder.dispatchedAt ? new Date(rawOrder.dispatchedAt) :
            findTimestampByStatus(rawOrder.historico || rawOrder.events, statusMapping.outForDelivery),
        deliveredDatetime: rawOrder.deliveredAt ? new Date(rawOrder.deliveredAt) :
            findTimestampByStatus(rawOrder.historico || rawOrder.events, statusMapping.delivered),
        customerName: rawOrder.cliente?.nome || rawOrder.customerName,
        deliveryAddress: rawOrder.endereco?.completo || rawOrder.deliveryAddress,
        orderValue: rawOrder.valorTotal || rawOrder.total,
        metadata: rawOrder,
    };
}

/**
 * Normalize order from Foody format
 */
function normalizefoody(rawOrder: any): NormalizedOrder {
    const statusMapping = STATUS_MAPPINGS.FOODY;

    return {
        externalId: rawOrder.order_id || rawOrder.id,
        logisticsProvider: 'FOODY',
        orderDatetime: new Date(rawOrder.created_at || rawOrder.order_time),
        readyDatetime: rawOrder.ready_at ? new Date(rawOrder.ready_at) :
            findTimestampByStatus(rawOrder.status_history, statusMapping.ready),
        outForDeliveryDatetime: rawOrder.dispatched_at ? new Date(rawOrder.dispatched_at) :
            findTimestampByStatus(rawOrder.status_history, statusMapping.outForDelivery),
        deliveredDatetime: rawOrder.delivered_at ? new Date(rawOrder.delivered_at) :
            findTimestampByStatus(rawOrder.status_history, statusMapping.delivered),
        customerName: rawOrder.customer?.name || rawOrder.customer_name,
        deliveryAddress: rawOrder.delivery_address?.full || rawOrder.address,
        orderValue: rawOrder.total_amount || rawOrder.order_value,
        metadata: rawOrder,
    };
}

/**
 * Normalize order from iFood format
 */
function normalizeIfood(rawOrder: any): NormalizedOrder {
    const statusMapping = STATUS_MAPPINGS.IFOOD;

    return {
        externalId: rawOrder.id || rawOrder.orderId,
        logisticsProvider: 'IFOOD',
        orderDatetime: new Date(rawOrder.createdAt || rawOrder.orderDateTime),
        readyDatetime: findTimestampByStatus(rawOrder.statusHistory || rawOrder.events, statusMapping.ready),
        outForDeliveryDatetime: findTimestampByStatus(rawOrder.statusHistory || rawOrder.events, statusMapping.outForDelivery),
        deliveredDatetime: findTimestampByStatus(rawOrder.statusHistory || rawOrder.events, statusMapping.delivered),
        customerName: rawOrder.customer?.name,
        deliveryAddress: rawOrder.delivery?.address?.formattedAddress,
        orderValue: rawOrder.total?.orderAmount,
        metadata: rawOrder,
    };
}

/**
 * Generic normalizer for unknown providers
 */
function normalizeGeneric(rawOrder: any, provider: string): NormalizedOrder {
    return {
        externalId: rawOrder.id || rawOrder.orderId || rawOrder.order_id || String(rawOrder.codigo || Math.random()),
        logisticsProvider: provider,
        orderDatetime: new Date(
            rawOrder.createdAt || rawOrder.created_at ||
            rawOrder.orderDateTime || rawOrder.order_datetime ||
            rawOrder.dataHoraPedido || new Date()
        ),
        readyDatetime: rawOrder.readyDatetime || rawOrder.ready_at ||
            rawOrder.readyAt ? new Date(rawOrder.readyDatetime || rawOrder.ready_at || rawOrder.readyAt) : null,
        outForDeliveryDatetime: rawOrder.outForDeliveryDatetime || rawOrder.dispatched_at ||
            rawOrder.dispatchedAt ? new Date(rawOrder.outForDeliveryDatetime || rawOrder.dispatched_at || rawOrder.dispatchedAt) : null,
        deliveredDatetime: rawOrder.deliveredDatetime || rawOrder.delivered_at ||
            rawOrder.deliveredAt ? new Date(rawOrder.deliveredDatetime || rawOrder.delivered_at || rawOrder.deliveredAt) : null,
        customerName: rawOrder.customerName || rawOrder.customer_name || rawOrder.cliente?.nome,
        deliveryAddress: rawOrder.deliveryAddress || rawOrder.delivery_address || rawOrder.endereco,
        orderValue: rawOrder.total || rawOrder.orderValue || rawOrder.order_value || rawOrder.valorTotal,
        metadata: rawOrder,
    };
}

/**
 * Main normalizer function - routes to appropriate provider-specific normalizer
 */
export function normalizeOrder(rawOrder: any, provider: string): NormalizedOrderWithTimes {
    let normalized: NormalizedOrder;

    const providerUpper = provider.toUpperCase();

    switch (providerUpper) {
        case 'AGILIZONE':
            normalized = normalizeAgilizone(rawOrder);
            break;
        case 'FOODY':
            normalized = normalizefoody(rawOrder);
            break;
        case 'IFOOD':
            normalized = normalizeIfood(rawOrder);
            break;
        default:
            normalized = normalizeGeneric(rawOrder, providerUpper);
    }

    // Calculate times
    const times = calculateOrderTimes({
        orderDatetime: normalized.orderDatetime,
        readyDatetime: normalized.readyDatetime,
        outForDeliveryDatetime: normalized.outForDeliveryDatetime,
        deliveredDatetime: normalized.deliveredDatetime,
    });

    return {
        ...normalized,
        ...times,
    };
}

/**
 * Normalize multiple orders
 */
export function normalizeOrders(rawOrders: any[], provider: string): NormalizedOrderWithTimes[] {
    return rawOrders.map(order => normalizeOrder(order, provider));
}
