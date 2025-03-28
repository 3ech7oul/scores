import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';



export type TransactionType = 'payout' | 'spent' | 'earned';

export interface Transaction {
    id: string;
    userId: string;
    createdAt: string;
    type: TransactionType;
    amount: number;
}

export interface PaginatedResponse {
    items: Transaction[];
    meta: {
        totalItems: number;
        itemCount: number;
        itemsPerPage: number;
        totalPages: number;
        currentPage: number;
    };
}

@Injectable()
export class MockService {
    private readonly TOTAL_MOCKED_TRANSACTIONS = 1200;
    private readonly MAX_DAYS = 90;
    private mockTransactions: Transaction[] = [];

    constructor() {
        this.generateMockTransactions();
    }

    private generateMockTransactions(): void {
        const transactionTypes: TransactionType[] = ['payout', 'spent', 'earned'];
        const userIds = ['74092', '85123', '63957'];

        for (let i = 0; i < this.TOTAL_MOCKED_TRANSACTIONS; i++) {
            const randomType = transactionTypes[Math.floor(Math.random() * transactionTypes.length)];
            const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];

            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * this.MAX_DAYS));

            let amount: number;
            if (randomType === 'earned') {
                amount = parseFloat((Math.random() * 50).toFixed(2));
            } else if (randomType === 'payout') {
                amount = Math.floor(Math.random() * 100) * 5;  // Payouts are in multiples of 5
            } else {
                amount = Math.floor(Math.random() * 100);
            }

            this.mockTransactions.push({
                id: uuidv4(),
                userId: randomUserId,
                createdAt: date.toISOString(),
                type: randomType,
                amount,
            });
        }

        // Sort transactions by date (newest first)
        this.mockTransactions.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    findAll(
        startDate: string,
        endDate: string,
        page: number,
        limit: number,
    ): PaginatedResponse {

        const startDateTime = new Date(startDate.replace(' ', 'T'));
        const endDateTime = new Date(endDate.replace(' ', 'T'));

        const filteredTransactions = this.mockTransactions.filter(
            (transaction) => {
                const transactionDate = new Date(transaction.createdAt);
                return transactionDate >= startDateTime && transactionDate <= endDateTime;
            },
        );

        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedItems = filteredTransactions.slice(startIndex, endIndex);

        return {
            items: paginatedItems,
            meta: {
                totalItems: filteredTransactions.length,
                itemCount: paginatedItems.length,
                itemsPerPage: limit,
                totalPages: Math.ceil(filteredTransactions.length / limit),
                currentPage: page,
            },
        };
    }
}