export interface Transaction {
    id: string;
    userId: string;
    timestamp: Date;
    status: string; // 'pending', 'processed', 'completed', etc.
    amount: number;
    currency: string;
}

export interface TransactionQueryParams {
    startDate?: Date;
    endDate?: Date;
    userId?: string;
    status?: string;
    limit?: number;
}

export interface TransactionStats {
    totalTransactions: number;
    totalAmount: number;
    amountInEUR: number;
    lastUpdated: Date;
}

export interface ApiTransactionResponse {
    items: ApiTransaction[];
    meta: {
        totalItems: number;
        itemCount: number;
        itemsPerPage: number;
        totalPages: number;
        currentPage: number;
    };
}

export interface ApiTransaction {
    id: string;
    userId: string;
    createdAt: string;
    type: string;
    amount: number;
}

export interface UserBalanceResponse {
    userId: string;
    balance: number;
    earned: number;
    spent: number;
    payout: number;
    paidOut: number;
    currency: string;
}

export interface UserPayout {
    userId: string;
    payoutAmount: number;
    currency: string;
}