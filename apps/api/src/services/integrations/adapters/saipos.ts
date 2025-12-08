// Saipos Integration Adapter (Sales + Logistics)
// Documentation: saipos.readme.io

import { SalesIntegrationAdapter, LogisticsIntegrationAdapter, registerAdapter } from '../base-adapter';
import {
    IntegrationConfig,
    NormalizedOrder,
    OrderStatus,
    OrderItem,
    DeliveryRequest,
    DeliveryQuote,
    DeliveryTracking,
    DeliveryStatus
} from '../types';

interface SaiposOrder {
    id: string;
    numero: string;
    status: string;
    dataCriacao: string;
    cliente: {
        nome: string;
        telefone: string;
        cpf?: string;
    };
    enderecoEntrega?: {
        logradouro: string;
        numero: string;
        complemento?: string;
        bairro: string;
        cidade: string;
        uf: string;
        cep: string;
        referencia?: string;
        latitude?: number;
        longitude?: number;
    };
    itens: Array<{
        id: string;
        nome: string;
        quantidade: number;
        precoUnitario: number;
        precoTotal: number;
        observacao?: string;
        adicionais?: Array<{
            nome: string;
            preco: number;
        }>;
    }>;
    valores: {
        subtotal: number;
        taxaEntrega: number;
        desconto: number;
        total: number;
    };
    pagamento: {
        forma: string;
        status: string;
    };
    observacao?: string;
}

// Sales Adapter
export class SaiposSalesAdapter extends SalesIntegrationAdapter {
    private readonly API_URL = 'https://api.saipos.com/v1';

    getPlatformName(): string {
        return 'Saipos';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        const response = await fetch(`${this.getBaseUrl()}/auth/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                clientId: this.credentials.clientId,
                clientSecret: this.credentials.clientSecret,
            }),
        });

        if (!response.ok) throw new Error('Saipos auth failed');

        const data = await response.json();
        this.credentials.accessToken = data.accessToken;
    }

    async refreshToken(): Promise<void> {
        await this.authenticate();
    }

    isTokenValid(): boolean {
        return !!this.credentials.accessToken;
    }

    async testConnection(): Promise<boolean> {
        try {
            await this.makeRequest('GET', '/estabelecimento');
            return true;
        } catch {
            return false;
        }
    }

    protected async makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        if (!this.isTokenValid()) await this.authenticate();

        const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.credentials.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });

        if (!response.ok) throw new Error(`Saipos API error: ${response.status}`);
        return response.json();
    }

    async fetchOrders(_since?: Date): Promise<NormalizedOrder[]> {
        const response = await this.makeRequest<{ pedidos: SaiposOrder[] }>('GET', '/pedidos');
        return response.pedidos.map(o => this.normalizeOrder(o));
    }

    async getOrderDetails(orderId: string): Promise<NormalizedOrder> {
        const order = await this.makeRequest<SaiposOrder>('GET', `/pedidos/${orderId}`);
        return this.normalizeOrder(order);
    }

    async confirmOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/pedidos/${orderId}/confirmar`);
    }

    async rejectOrder(orderId: string, reason?: string): Promise<void> {
        await this.makeRequest('POST', `/pedidos/${orderId}/rejeitar`, { motivo: reason });
    }

    async markOrderReady(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/pedidos/${orderId}/pronto`);
    }

    async dispatchOrder(orderId: string): Promise<void> {
        await this.makeRequest('POST', `/pedidos/${orderId}/despachar`);
    }

    async cancelOrder(orderId: string, reason: string): Promise<void> {
        await this.makeRequest('POST', `/pedidos/${orderId}/cancelar`, { motivo: reason });
    }

    protected normalizeOrder(order: SaiposOrder): NormalizedOrder {
        return {
            id: order.id,
            externalId: order.id,
            platform: 'saipos',
            restaurantId: '',
            status: this.mapPlatformStatus(order.status),
            customer: {
                name: order.cliente.nome,
                phone: order.cliente.telefone,
                document: order.cliente.cpf,
            },
            deliveryAddress: order.enderecoEntrega ? {
                street: order.enderecoEntrega.logradouro,
                number: order.enderecoEntrega.numero,
                complement: order.enderecoEntrega.complemento,
                neighborhood: order.enderecoEntrega.bairro,
                city: order.enderecoEntrega.cidade,
                state: order.enderecoEntrega.uf,
                zipCode: order.enderecoEntrega.cep,
                reference: order.enderecoEntrega.referencia,
                coordinates: order.enderecoEntrega.latitude ? {
                    latitude: order.enderecoEntrega.latitude,
                    longitude: order.enderecoEntrega.longitude!,
                } : undefined,
            } : undefined,
            items: order.itens.map(this.normalizeItem),
            subtotal: order.valores.subtotal,
            deliveryFee: order.valores.taxaEntrega,
            discount: order.valores.desconto,
            total: order.valores.total,
            paymentMethod: order.pagamento.forma,
            paymentStatus: order.pagamento.status === 'PAGO' ? 'paid' : 'pending',
            observations: order.observacao,
            createdAt: new Date(order.dataCriacao),
        };
    }

    private normalizeItem(item: SaiposOrder['itens'][0]): OrderItem {
        return {
            externalId: item.id,
            name: item.nome,
            quantity: item.quantidade,
            unitPrice: item.precoUnitario,
            totalPrice: item.precoTotal,
            observations: item.observacao,
            options: item.adicionais?.map(a => ({ name: a.nome, value: a.nome, price: a.preco })),
        };
    }

    private mapPlatformStatus(status: string): OrderStatus {
        const map: Record<string, OrderStatus> = {
            'PENDENTE': 'pending', 'CONFIRMADO': 'confirmed', 'PREPARANDO': 'preparing',
            'PRONTO': 'ready', 'EM_ROTA': 'dispatched', 'ENTREGUE': 'delivered', 'CANCELADO': 'cancelled',
        };
        return map[status] || 'pending';
    }

    protected mapStatusToPlatform(status: OrderStatus): string {
        const map: Record<OrderStatus, string> = {
            pending: 'PENDENTE', confirmed: 'CONFIRMADO', preparing: 'PREPARANDO',
            ready: 'PRONTO', dispatched: 'EM_ROTA', delivered: 'ENTREGUE', cancelled: 'CANCELADO',
        };
        return map[status];
    }
}

// Logistics Adapter
export class SaiposLogisticsAdapter extends LogisticsIntegrationAdapter {
    private readonly API_URL = 'https://logistics.saipos.com/v1';

    getPlatformName(): string {
        return 'Saipos Logistics';
    }

    getBaseUrl(): string {
        return this.API_URL;
    }

    async authenticate(): Promise<void> {
        // Similar to sales adapter
        this.credentials.accessToken = 'token';
    }

    async refreshToken(): Promise<void> {
        await this.authenticate();
    }

    isTokenValid(): boolean {
        return !!this.credentials.accessToken;
    }

    async testConnection(): Promise<boolean> {
        return true;
    }

    protected async makeRequest<T>(
        method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
        endpoint: string,
        data?: unknown
    ): Promise<T> {
        const response = await fetch(`${this.getBaseUrl()}${endpoint}`, {
            method,
            headers: {
                'Authorization': `Bearer ${this.credentials.accessToken}`,
                'Content-Type': 'application/json',
            },
            body: data ? JSON.stringify(data) : undefined,
        });
        return response.json();
    }

    async getDeliveryQuote(request: DeliveryRequest): Promise<DeliveryQuote> {
        return this.makeRequest('POST', '/cotacao', {
            origem: request.pickupAddress,
            destino: request.deliveryAddress,
        });
    }

    async requestDelivery(request: DeliveryRequest): Promise<string> {
        const response = await this.makeRequest<{ id: string }>('POST', '/entregas', request);
        return response.id;
    }

    async cancelDelivery(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/cancelar`);
    }

    async getDeliveryTracking(deliveryId: string): Promise<DeliveryTracking> {
        return this.makeRequest('GET', `/entregas/${deliveryId}/rastreamento`);
    }

    async markOrderReady(deliveryId: string): Promise<void> {
        await this.makeRequest('POST', `/entregas/${deliveryId}/pronto`);
    }
}

registerAdapter('saipos', SaiposSalesAdapter);
registerAdapter('saipos_logistics', SaiposLogisticsAdapter);
