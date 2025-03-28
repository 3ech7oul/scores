import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { TransactionRepository } from './transaction.repository';
import { Transaction, UserBalanceResponse, UserPayout } from './types/transaction.types';

@Injectable()
export class TransactionService {
    private readonly logger = new Logger(TransactionService.name);
    private readonly apiUrl = process.env.TRANSACTIONS_API_URL || 'http://localhost:3000';

    constructor(
        private readonly httpService: HttpService,
        private readonly transactionRepository: TransactionRepository,
    ) { }

    async getAggregatedPayoutRequests(): Promise<UserPayout[]> {
        try {
            this.logger.log('Fetching requested payouts and aggregating by user');


            // Based on the mapTypeToStatus method, "completed" corresponds to payout transactions
            const payoutTransactions = await this.transactionRepository.findTransactions({
                status: 'completed'
            });

            if (payoutTransactions.length === 0) {
                this.logger.warn('No payout transactions found');
                return [];
            }

            // Create a map to aggregate payout amounts by user ID
            const userPayoutMap = new Map<string, { amount: number; currency: string }>();

            // Aggregate payout amounts for each user
            for (const transaction of payoutTransactions) {
                const userId = transaction.userId;
                const amount = transaction.amount;
                const currency = transaction.currency || 'SCR';

                if (userPayoutMap.has(userId)) {
                    // Add to existing amount
                    const current = userPayoutMap.get(userId);
                    userPayoutMap.set(userId, {
                        amount: (current?.amount ?? 0) + amount,
                        currency: current?.currency ?? 'SCR'
                    });
                } else {
                    // Create new entry
                    userPayoutMap.set(userId, { amount, currency });
                }
            }

            // Convert map to array of UserPayout objects
            const result: UserPayout[] = Array.from(userPayoutMap.entries()).map(([userId, data]) => ({
                userId,
                payoutAmount: data.amount,
                currency: data.currency
            }));

            this.logger.log(`Successfully aggregated payout data for ${result.length} users`);

            return result;
        } catch (error) {
            this.logger.error(`Failed to get aggregated payout data: ${error.message}`);
            throw error;
        }
    }

    async getUserBalance(userId: string): Promise<UserBalanceResponse> {
        try {
            this.logger.log(`Fetching aggregated data for user ${userId}`);

            // Query all transactions for this user from our repository
            const userTransactions = await this.transactionRepository.findTransactions({
                userId: userId
            });

            if (userTransactions.length === 0) {
                this.logger.warn(`No transactions found for user ${userId}`);
                return {
                    userId,
                    balance: 0,
                    earned: 0,
                    spent: 0,
                    payout: 0,
                    paidOut: 0,
                    currency: 'SCR' // Default currency
                };
            }

            // Initialize aggregation values
            let earned = 0;
            let spent = 0;
            let payout = 0;
            let paidOut = 0;

            // Group and aggregate based on status
            for (const transaction of userTransactions) {
                switch (transaction.status) {
                    case 'pending': // earned
                        earned += transaction.amount;
                        break;
                    case 'processed': // spent
                        spent += transaction.amount;
                        break;
                    case 'completed': // payout
                        payout += transaction.amount;
                        paidOut += transaction.amount; // Paid out is the sum of completed payouts
                        break;
                    default:
                        this.logger.warn(`Unhandled transaction status: ${transaction.status} for transaction ${transaction.id}`);
                }
            }

            const balance = earned - spent - paidOut;
            const currency = userTransactions[0].currency || 'SCR';

            this.logger.log(`Successfully calculated aggregated data for user ${userId}`);

            return {
                userId,
                balance,
                earned,
                spent,
                payout,
                paidOut,
                currency
            };
        } catch (error) {
            this.logger.error(`Failed to get aggregated data for user ${userId}: ${error.message}`);
            throw error;
        }
    }

    async fetchAndStoreTransactions(startDate?: Date, endDate?: Date, page = 1): Promise<number> {
        try {
            // Build query parameters
            const params: Record<string, string> = {
                page: page.toString()
            };

            if (startDate) {
                params.startDate = this.formatDate(startDate);
            }

            if (endDate) {
                params.endDate = this.formatDate(endDate);
            }

            // Make API request
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.apiUrl}/mock-transactions`, { params }).pipe(
                    catchError((error: AxiosError) => {
                        this.logger.error(`Error fetching transactions: ${error.message}`, error.stack);
                        throw error;
                    }),
                ),
            );

            // Map API response to our Transaction type
            const transactions: Transaction[] = data.items.map(item => ({
                id: item.id,
                userId: item.userId,
                timestamp: new Date(item.createdAt),
                status: this.mapTypeToStatus(item.type),
                amount: item.amount,
                currency: 'SCR', // Assuming default currency is SCR
            }));

            // Store transactions in repository
            await this.transactionRepository.saveMany(transactions);

            // Return number of transactions processed
            return transactions.length;
        } catch (error) {
            this.logger.error(`Failed to fetch and store transactions: ${error.message}`);
            throw error;
        }
    }

    async fetchAllTransactions(startDate?: Date, endDate?: Date): Promise<void> {
        let currentPage = 1;
        let totalPages = 1;
        let totalProcessed = 0;

        do {
            try {
                const processed = await this.fetchAndStoreTransactions(startDate, endDate, currentPage);
                totalProcessed += processed;


                // Get pagination info from the most recent call
                const { data } = await firstValueFrom(
                    this.httpService.get(`${this.apiUrl}/mock-transactions`, {
                        params: {
                            page: currentPage.toString(),
                            ...(startDate && { startDate: this.formatDate(startDate) }),
                            ...(endDate && { endDate: this.formatDate(endDate) })
                        }
                    })
                );

                totalPages = data.meta.totalPages;
                this.logger.log(`Processed page ${currentPage}/${totalPages}, ${totalProcessed} transactions so far`);

                currentPage++;
            } catch (error) {
                this.logger.error(`Error during pagination at page ${currentPage}: ${error.message}`);
                break;
            }
        } while (currentPage <= totalPages);

        this.logger.log(`Completed fetching all transactions. Total processed: ${totalProcessed}`);
    }

    async syncTransactions(days = 30): Promise<void> {
        try {
            // Get the latest transaction date from our repository
            const latestTimestamp = await this.transactionRepository.getLatestTransactionTimestamp();

            // If we have transactions, start from the latest one
            // Otherwise, default to fetching the last X days
            const startDate = latestTimestamp || new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const endDate = new Date();

            this.logger.log(`Syncing transactions from ${startDate.toISOString()} to ${endDate.toISOString()}`);
            await this.fetchAllTransactions(startDate, endDate);

            const count = await this.transactionRepository.count();
            this.logger.log(`Sync completed. Repository now contains ${count} transactions.`);
        } catch (error) {
            this.logger.error(`Transaction sync failed: ${error.message}`);
            throw error;
        }
    }

    private formatDate(date: Date): string {
        return date.toISOString().replace('T', ' ').substring(0, 19);
    }

    private mapTypeToStatus(type: string): string {
        switch (type.toLowerCase()) {
            case 'payout':
                return 'completed';
            case 'spent':
                return 'processed';
            case 'earned':
                return 'pending';
            default:
                return 'unknown';
        }
    }
}