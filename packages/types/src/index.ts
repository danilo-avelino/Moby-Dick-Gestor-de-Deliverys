// ==========================================
// SHARED TYPES FOR DELIVERY SAAS PLATFORM
// ==========================================

// Note: Prisma types should be imported directly from 'database' package
// to avoid circular dependency issues during build

// ==========================================
// ENUMS
// ==========================================

export enum UserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    MANAGER = 'MANAGER',
    STAFF = 'STAFF',
    VIEWER = 'VIEWER',
    DIRETOR = 'DIRETOR',
    ESTOQUE = 'ESTOQUE',
    CHEF_DE_COZINHA = 'CHEF_DE_COZINHA',
    LIDER_DESPACHO = 'LIDER_DESPACHO',
}

export enum IntegrationPlatform {
    IFOOD = 'IFOOD',
    RAPPI = 'RAPPI',
    UBER_EATS = 'UBER_EATS',
    LINX = 'LINX',
    TOTVS = 'TOTVS',
    STONE = 'STONE',
    BLING = 'BLING',
    TINY = 'TINY',
    CUSTOM_API = 'CUSTOM_API',
}

export enum IntegrationStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    ERROR = 'ERROR',
    PENDING_AUTH = 'PENDING_AUTH',
    SYNCING = 'SYNCING',
}

export enum MovementType {
    IN = 'IN',
    OUT = 'OUT',
    ADJUSTMENT = 'ADJUSTMENT',
    TRANSFER = 'TRANSFER',
    WASTE = 'WASTE',
    PRODUCTION = 'PRODUCTION',
    RETURN = 'RETURN',
}

export enum AlertType {
    STOCK_LOW = 'STOCK_LOW',
    STOCK_EXPIRING = 'STOCK_EXPIRING',
    CMV_HIGH = 'CMV_HIGH',
    COST_INCREASE = 'COST_INCREASE',
    MARGIN_NEGATIVE = 'MARGIN_NEGATIVE',
    YIELD_LOW = 'YIELD_LOW',
    INTEGRATION_ERROR = 'INTEGRATION_ERROR',
    ANOMALY_DETECTED = 'ANOMALY_DETECTED',
    GOAL_ACHIEVED = 'GOAL_ACHIEVED',
    GOAL_NEAR = 'GOAL_NEAR',
}

export enum AlertSeverity {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH',
    CRITICAL = 'CRITICAL',
}

export enum SalesChannel {
    DINE_IN = 'DINE_IN',
    TAKEOUT = 'TAKEOUT',
    DELIVERY_OWN = 'DELIVERY_OWN',
    DELIVERY_IFOOD = 'DELIVERY_IFOOD',
    DELIVERY_RAPPI = 'DELIVERY_RAPPI',
    DELIVERY_UBER = 'DELIVERY_UBER',
}

export enum ABCClassification {
    A = 'A',
    B = 'B',
    C = 'C',
}

export enum MatrixClassification {
    STAR = 'STAR',
    CASH_COW = 'CASH_COW',
    PUZZLE = 'PUZZLE',
    DOG = 'DOG',
}

// ==========================================
// API DTOs
// ==========================================

// Auth
export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    user: UserDTO;
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    restaurantName: string;
    phone?: string;
}

export interface RefreshTokenRequest {
    refreshToken: string;
}

export interface RefreshTokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

// User
export interface UserDTO {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    avatarUrl?: string;
    role: UserRole;
    restaurantId?: string;
    organizationId?: string | null;
    scope?: 'ORG' | 'RESTAURANTS';
    restaurant?: RestaurantDTO;
    permissions?: { allowedRestaurantIds: string[] };
    impersonatedBy?: string;
    createdAt: string;
}

export interface UpdateUserRequest {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
}

// Restaurant
export interface RestaurantDTO {
    id: string;
    name: string;
    tradeName?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    address?: AddressDTO;
    settings: RestaurantSettings;
    createdAt: string;
}

export interface AddressDTO {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country: string;
}

export interface RestaurantSettings {
    timezone: string;
    currency: string;
    locale: string;
    targetCmvPercent: number;
    alertCmvThreshold: number;
    primaryColor: string;
    secondaryColor: string;
}

export interface UpdateRestaurantRequest {
    name?: string;
    tradeName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    address?: Partial<AddressDTO>;
    settings?: Partial<RestaurantSettings>;
}

// Products
export interface ProductDTO {
    id: string;
    sku?: string;
    barcode?: string;
    name: string;
    description?: string;
    category?: CategoryDTO;
    baseUnit: string;
    currentStock: number;
    reorderPoint?: number;
    manualReorderPoint?: number;
    last7DaysConsumption?: number;
    avgCost: number;
    lastPurchasePrice: number;
    isPerishable: boolean;
    shelfLifeDays?: number;
    defaultSupplier?: Partial<SupplierDTO>;
    isActive: boolean;
    imageUrl?: string;
    createdAt: string;
    updatedAt: string;
    movements?: StockMovementDTO[];
    chartData?: any[];
    recipeCount?: number;
}

export interface CreateProductRequest {
    sku?: string;
    barcode?: string;
    name: string;
    description?: string;
    categoryId?: string;
    baseUnit: string;
    conversions?: Record<string, number>;
    reorderPoint?: number;
    manualReorderPoint?: number;
    isPerishable?: boolean;
    shelfLifeDays?: number;
    defaultSupplierId?: string;
    leadTimeDays?: number;
    imageUrl?: string;
}

export interface UpdateProductRequest extends Partial<CreateProductRequest> {
    isActive?: boolean;
}

// Categories
export interface CategoryDTO {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
    children?: CategoryDTO[];
    productCount?: number;
}

export interface CreateCategoryRequest {
    name: string;
    description?: string;
    parentId?: string;
}

// Suppliers
export interface SupplierDTO {
    id: string;
    name: string;
    tradeName?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    city?: string;
    state?: string;
    paymentTerms?: string;
    rating?: number;
    isActive: boolean;
}

export interface CreateSupplierRequest {
    name: string;
    tradeName?: string;
    cnpj?: string;
    email?: string;
    phone?: string;
    whatsapp?: string;
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    paymentTerms?: string;
}

// Stock Movements
export interface StockMovementDTO {
    id: string;
    product: ProductDTO;
    type: MovementType;
    quantity: number;
    unit: string;
    costPerUnit: number;
    totalCost: number;
    stockBefore: number;
    stockAfter: number;
    referenceType?: string;
    referenceId?: string;
    supplier?: SupplierDTO;
    invoiceNumber?: string;
    notes?: string;
    user?: UserDTO;
    createdAt: string;
}

export interface CreateStockMovementRequest {
    productId: string;
    type: MovementType;
    quantity: number;
    unit: string;
    costPerUnit?: number;
    supplierId?: string;
    invoiceNumber?: string;
    notes?: string;
    batchNumber?: string;
    expirationDate?: string;
}

// Recipes
export interface RecipeDTO {
    id: string;
    name: string;
    description?: string;
    category?: CategoryDTO;
    yieldQuantity: number;
    yieldUnit: string;
    currentCost: number;
    costPerUnit: number;
    suggestedPrice?: number;
    currentPrice?: number;
    marginPercent?: number;
    packagingCost: number;
    laborCost: number;
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    isActive: boolean;
    imageUrl?: string;
    ingredients: RecipeIngredientDTO[];
    createdAt: string;
    updatedAt: string;
}

export interface RecipeIngredientDTO {
    id: string;
    ingredientType: 'PRODUCT' | 'RECIPE';
    product?: ProductDTO;
    subRecipe?: { id: string; name: string; costPerUnit: number };
    quantity: number;
    unit: string;
    costSnapshot: number;
    totalCost: number;
}

export interface CreateRecipeRequest {
    name: string;
    description?: string;
    categoryId?: string;
    yieldQuantity: number;
    yieldUnit: string;
    currentPrice?: number;
    packagingCost?: number;
    laborCost?: number;
    overheadPercent?: number;
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    imageUrl?: string;
    instructions?: string;
    ingredients: CreateRecipeIngredientRequest[];
}

export interface CreateRecipeIngredientRequest {
    ingredientType: 'PRODUCT' | 'RECIPE';
    productId?: string;
    subRecipeId?: string;
    quantity: number;
    unit: string;
}

export interface UpdateRecipeRequest extends Partial<CreateRecipeRequest> {
    isActive?: boolean;
}

// CMV
export interface CMVSnapshotDTO {
    id: string;
    date: string;
    revenue: number;
    orderCount: number;
    avgTicket: number;
    theoreticalCogs: number;
    realCogs: number;
    theoreticalPercent: number;
    realPercent: number;
    wastePercent: number;
    wasteAmount: number;
}

export interface CMVSummaryDTO {
    period: 'daily' | 'weekly' | 'monthly';
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalOrders: number;
    avgTicket: number;
    avgTheoreticalPercent: number;
    avgRealPercent: number;
    avgWastePercent: number;
    totalWasteAmount: number;
    trend: 'up' | 'down' | 'stable';
    trendPercent: number;
    snapshots: CMVSnapshotDTO[];
}

// Menu Analysis
export interface MenuAnalysisDTO {
    id: string;
    periodStart: string;
    periodEnd: string;
    totalRevenue: number;
    totalItemsSold: number;
    items: ItemPerformanceDTO[];
}

export interface ItemPerformanceDTO {
    id: string;
    recipe: RecipeDTO;
    quantitySold: number;
    revenue: number;
    cost: number;
    marginAmount: number;
    marginPercent: number;
    popularityScore: number;
    profitabilityScore: number;
    abcClassification?: ABCClassification;
    matrixClassification?: MatrixClassification;
    recommendedAction?: string;
    actionReasoning?: string;
}

// Alerts
export interface AlertDTO {
    id: string;
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
    isRead: boolean;
    readAt?: string;
    createdAt: string;
    expiresAt?: string;
}

// Goals
export interface GoalDTO {
    id: string;
    user?: UserDTO;
    teamId?: string;
    type: string;
    name: string;
    description?: string;
    targetValue: number;
    currentValue: number;
    progressPercent: number;
    period: string;
    periodStart: string;
    periodEnd: string;
    rewardType?: string;
    rewardValue?: string;
    rewardPoints: number;
    isActive: boolean;
    achievedAt?: string;
}

export interface CreateGoalRequest {
    userId?: string;
    teamId?: string;
    type: string;
    name: string;
    description?: string;
    targetValue: number;
    period: string;
    periodStart: string;
    periodEnd: string;
    rewardType?: string;
    rewardValue?: string;
    rewardPoints?: number;
}

// Integrations
export interface IntegrationDTO {
    id: string;
    platform: IntegrationPlatform;
    name: string;
    status: IntegrationStatus;
    syncFrequencyMinutes: number;
    lastSyncAt?: string;
    nextSyncAt?: string;
    externalId?: string;
    createdAt: string;
}

export interface ConnectIntegrationRequest {
    platform: IntegrationPlatform;
    name: string;
    credentials?: Record<string, string>;
    syncFrequencyMinutes?: number;
}

// Purchase Suggestions (AI)
export interface PurchaseSuggestionDTO {
    id: string;
    product: ProductDTO;
    currentStock: number;
    avgDailyConsumption: number;
    suggestedQuantity: number;
    suggestedUnit: string;
    reorderPoint: number;
    leadTimeDays: number;
    estimatedRunoutDate?: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    reasoning?: string;
    confidence: number;
    isAccepted?: boolean;
    generatedAt: string;
}

// Dashboard
export interface DashboardKPIsDTO {
    revenue: {
        today: number;
        yesterday: number;
        thisWeek: number;
        thisMonth: number;
        trend: number;
    };
    orders: {
        today: number;
        yesterday: number;
        thisWeek: number;
        thisMonth: number;
        trend: number;
    };
    avgTicket: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        trend: number;
    };
    cmv: {
        today: number;
        thisWeek: number;
        thisMonth: number;
        target: number;
        trend: number;
    };
    alerts: {
        unread: number;
        critical: number;
    };
    stockAlerts: {
        lowStock: number;
        expiring: number;
    };
}

export interface TopSellingItemDTO {
    recipe: RecipeDTO;
    quantity: number;
    revenue: number;
    marginPercent: number;
}

// ==========================================
// PAGINATION
// ==========================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}

// ==========================================
// API RESPONSE
// ==========================================

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: ApiError;
    meta?: Record<string, unknown>;
}

export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, string[]>;
}

// ==========================================
// WEBSOCKET EVENTS
// ==========================================

export interface WebSocketEvent<T = unknown> {
    type: string;
    payload: T;
    timestamp: string;
}

export type AlertEvent = WebSocketEvent<AlertDTO>;
export type StockUpdateEvent = WebSocketEvent<{ productId: string; newStock: number }>;
export type OrderEvent = WebSocketEvent<{ orderId: string; status: string; total: number }>;
export type GoalProgressEvent = WebSocketEvent<{ goalId: string; currentValue: number; progressPercent: number }>;

// ==========================================
// STOCK REQUESTS
// ==========================================

export enum StockRequestStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
}

export interface StockRequestDTO {
    id: string;
    code: string;
    restaurantId: string;
    // restaurant?: RestaurantDTO;
    createdByUserId: string;
    createdBy?: UserDTO;
    status: StockRequestStatus;
    chefObservation?: string;
    approvedAt?: string;
    approvedByUserId?: string;
    approvedBy?: UserDTO;
    createdAt: string;
    updatedAt: string;
    items?: StockRequestItemDTO[];
    comments?: StockRequestCommentDTO[];
}

export interface StockRequestItemDTO {
    id: string;
    stockRequestId: string;
    productId: string;
    product?: ProductDTO;
    productNameSnapshot: string;
    unitSnapshot: string;
    quantityRequested: number;
    quantityApproved?: number;
    notes?: string;
    createdAt: string;
}

export interface StockRequestCommentDTO {
    id: string;
    stockRequestId: string;
    userId: string;
    user?: UserDTO;
    message: string;
    createdAt: string;
}

export interface CreateStockRequestRequest {
    chefObservation?: string;
    items: {
        productId: string;
        quantity: number;
        // unit: string; // usually derived from product, but if we want to support multiple units we need more logic. 
        // For simplicity let's stick to base unit or derived in backend.
        notes?: string;
    }[];
}

export interface ApproveStockRequestRequest {
    items: {
        itemId: string;
        quantityApproved: number;
    }[];
}

export interface CreateStockRequestCommentRequest {
    message: string;
}

export interface StockRequestTemplateDTO {
    id: string;
    restaurantId: string;
    name?: string;
    items: {
        productId: string;
    }[];
}

export interface SaveStockRequestTemplateRequest {
    name?: string;
    items: {
        productId: string;
    }[];
}
