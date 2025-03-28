import { Controller, Get, Query, ParseIntPipe, Logger, Post } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { Transaction, TransactionStats, TransactionQueryParams, UserBalanceResponse, UserPayout } from './types/transaction.types';

@Controller('transactions')
export class TransactionController {
    private readonly logger = new Logger(TransactionController.name);

    constructor(
        private readonly transactionService: TransactionService,
        private readonly transactionRepository: TransactionRepository,
    ) { }


    @Get('balance')
    async getUserBalance(
        @Query('user') userId: string,
    ): Promise<UserBalanceResponse> {
        return this.transactionService.getUserBalance(userId);
    }

    @Get('payouts')
    async getAggregatedPayoutRequests(
        @Query('user') userId: string,
    ): Promise<UserPayout[]> {
        return this.transactionService.getAggregatedPayoutRequests();
    }

    @Get()
    async getTransactions(
        @Query('startDate') startDateStr?: string,
        @Query('endDate') endDateStr?: string,
        @Query('status') status?: string,
        @Query('userId') userId?: string,
        @Query('limit', ParseIntPipe) limit?: number,
    ): Promise<Transaction[]> {
        // Parse dates manually
        const startDate = startDateStr ? new Date(startDateStr) : undefined;
        const endDate = endDateStr ? new Date(endDateStr) : undefined;

        const params: TransactionQueryParams = {
            startDate,
            endDate,
            status,
            userId,
            limit,
        };

        return this.transactionRepository.findTransactions(params);
    }

    @Get('stats')
    async getTransactionStats(): Promise<TransactionStats> {
        return this.transactionRepository.getStats();
    }

    @Post('sync')
    async syncTransactions(
        @Query('days', ParseIntPipe) days = 30,
    ): Promise<{ message: string }> {
        this.logger.log(`Manual sync triggered for the last ${days} days`);
        await this.transactionService.syncTransactions(days);

        return { message: 'Transactions synced successfully' };
    }

    @Cron(CronExpression.EVERY_5_SECONDS)
    async scheduledSync() {
        this.logger.log('Running scheduled transaction sync');
        try {
            await this.transactionService.syncTransactions(1); // Sync last 24 hours by default
            this.logger.log('Scheduled sync completed successfully');
        } catch (error) {
            this.logger.error(`Scheduled sync failed: ${error.message}`);
        }
    }
}