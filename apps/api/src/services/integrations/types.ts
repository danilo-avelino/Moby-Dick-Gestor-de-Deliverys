// Base Integration Types and Interfaces

export type IntegrationType = 'sales' | 'logistics';

export interface IntegrationCredentials {
    clientId?: string;
    clientSecret?: string;
    apiToken?: string;
    merchantId?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: Date;
}

export interface IntegrationConfig {
    platform: string;
    type: IntegrationType;
    credentials: IntegrationCredentials;
    webhookUrl?: string;
    sandboxMode: boolean;
}

// Order Types (normalized across platforms)
export interface NormalizedOrder {
    id: string;
    externalId: string;
    platform: string;
    restaurantId: string;
    status: OrderStatus;
    customer: {
        name: string;
        phone?: string;
        document?: string;
    };
    deliveryAddress?: {
        street: string;
        number: string;
        complement?: string;
        neighborhood: string;
        city: string;
        state: string;
        zipCode: string;
        reference?: string;
        coordinates?: {
            latitude: number;
            longitude: number;
        };
    };
    items: OrderItem[];
    subtotal: number;
    deliveryFee: number;
    discount: number;
    total: number;
    paymentMethod: string;
    paymentStatus: 'pending' | 'paid' | 'refunded';
    observations?: string;
    createdAt: Date;
    confirmedAt?: Date;
    readyAt?: Date;
    dispatchedAt?: Date;
    deliveredAt?: Date;
}

export interface OrderItem {
    externalId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    observations?: string;
    options?: {
        name: string;
        value: string;
        price: number;
    }[];
}

export type OrderStatus =
    | 'pending'
    | 'confirmed'
    | 'preparing'
    | 'ready'
    | 'dispatched'
    | 'delivered'
    | 'cancelled';

// Delivery/Logistics Types
export interface DeliveryRequest {
    orderId: string;
    pickupAddress: AddressInfo;
    deliveryAddress: AddressInfo;
    items?: string;
    observations?: string;
}

export interface AddressInfo {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
}

export interface DeliveryQuote {
    available: boolean;
    price?: number;
    estimatedMinutes?: number;
    distance?: number;
}

export interface DeliveryTracking {
    status: DeliveryStatus;
    driverName?: string;
    driverPhone?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    estimatedArrival?: Date;
    events: DeliveryEvent[];
}

export interface DeliveryEvent {
    status: DeliveryStatus;
    timestamp: Date;
    description?: string;
}

export type DeliveryStatus =
    | 'pending'
    | 'accepted'
    | 'arriving_pickup'
    | 'at_pickup'
    | 'picked_up'
    | 'in_transit'
    | 'arriving_delivery'
    | 'delivered'
    | 'cancelled';

// Catalog Types
export interface CatalogItem {
    externalId?: string;
    name: string;
    description?: string;
    price: number;
    categoryId?: string;
    imageUrl?: string;
    available: boolean;
    options?: CatalogOption[];
}

export interface CatalogOption {
    name: string;
    required: boolean;
    minQuantity: number;
    maxQuantity: number;
    values: {
        name: string;
        price: number;
    }[];
}

// Webhook Event Types
export interface WebhookEvent {
    platform: string;
    eventType: string;
    payload: unknown;
    receivedAt: Date;
    signature?: string;
}
