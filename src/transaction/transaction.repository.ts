import { Injectable, Logger } from '@nestjs/common';
import { Transaction, TransactionQueryParams, TransactionStats } from './types/transaction.types';

/**
 * Repository to store and query transactions in memory
 * In a production environment, this would use a database like MongoDB or PostgreSQL
 */
@Injectable()
export class TransactionRepository {
    private readonly logger = new Logger(TransactionRepository.name);
    private transactions: Map<string, Transaction> = new Map();
    private lastUpdated: Date = new Date();

    /**
     * Save multiple transactions
     */
    async saveMany(transactions: Transaction[]): Promise<void> {
        for (const transaction of transactions) {
            this.transactions.set(transaction.id, transaction);
        }
        this.lastUpdated = new Date();
        this.logger.log(`Saved ${transactions.length} transactions. Total: ${this.transactions.size}`);
    }

    /**
     * Query transactions with optional filters
     */
    async findTransactions(params: TransactionQueryParams): Promise<Transaction[]> {
        let result = Array.from(this.transactions.values());

        if (params.startDate) {
            if (params.startDate) {
                result = result.filter(tx => params.startDate && tx.timestamp >= params.startDate);
            }
        }

        if (params.endDate) {
            result = result.filter(tx => params.endDate && tx.timestamp <= params.endDate);
        }

        if (params.status) {
            result = result.filter(tx => tx.status === params.status);
        }

        if (params.userId) {
            result = result.filter(tx => tx.userId === params.userId);
        }

        // Sort by timestamp descending (newest first)
        result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        if (params.limit) {
            result = result.slice(0, params.limit);
        }

        return result;
    }

    /**
     * Get transaction statistics
     */
    async getStats(): Promise<TransactionStats> {
        const transactions = Array.from(this.transactions.values());

        const totalTransactions = transactions.length;
        const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

        // Convert all amounts to EUR (assuming 1 SCR = 1 EUR as per requirements)
        const amountInEUR = transactions.reduce((sum, tx) => {
            if (tx.currency === 'EUR') {
                return sum + tx.amount;
            } else if (tx.currency === 'SCR') {
                return sum + tx.amount; // 1:1 conversion
            }
            return sum;
        }, 0);

        return {
            totalTransactions,
            totalAmount,
            amountInEUR,
            lastUpdated: this.lastUpdated,
        };
    }

    /**
     * Get the timestamp of the latest transaction
     */
    async getLatestTransactionTimestamp(): Promise<Date | null> {
        const transactions = Array.from(this.transactions.values());
        if (transactions.length === 0) {
            return null;
        }

        // Find the transaction with the latest timestamp
        return transactions.reduce(
            (latest, tx) => tx.timestamp > latest ? tx.timestamp : latest,
            new Date(0),
        );
    }

    /**
     * Get the total number of stored transactions
     */
    async count(): Promise<number> {
        return this.transactions.size;
    }
}