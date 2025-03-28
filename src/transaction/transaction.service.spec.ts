import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { Transaction } from './types/transaction.types';

describe('TransactionService', () => {
    let service: TransactionService;
    let repository: TransactionRepository;

    const mockLogger = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockHttpService = {
        get: jest.fn(),
    };

    const mockRepository = {
        findTransactions: jest.fn(),
        saveMany: jest.fn(),
        getLatestTransactionTimestamp: jest.fn(),
        count: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TransactionService,
                { provide: HttpService, useValue: mockHttpService },
                { provide: TransactionRepository, useValue: mockRepository },
            ],
        }).compile();

        jest.spyOn(Logger.prototype, 'log').mockImplementation(mockLogger.log);
        jest.spyOn(Logger.prototype, 'error').mockImplementation(mockLogger.error);
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(mockLogger.warn);

        service = module.get<TransactionService>(TransactionService);
        repository = module.get<TransactionRepository>(TransactionRepository);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getUserBalance', () => {
        it('should return default values when no transactions are found', async () => {
            const userId = 'user123';
            mockRepository.findTransactions.mockResolvedValue([]);
            const result = await service.getUserBalance(userId);

            expect(result).toEqual({
                userId,
                balance: 0,
                earned: 0,
                spent: 0,
                payout: 0,
                paidOut: 0,
                currency: 'SCR',
            });
            expect(mockRepository.findTransactions).toHaveBeenCalledWith({ userId });
            expect(mockLogger.warn).toHaveBeenCalledWith(`No transactions found for user ${userId}`);
        });

        it('should correctly aggregate transactions with different statuses', async () => {
            const userId = 'user123';
            const mockTransactions: Transaction[] = [
                { id: '1', userId, timestamp: new Date(), status: 'pending', amount: 100, currency: 'SCR' },
                { id: '2', userId, timestamp: new Date(), status: 'pending', amount: 50, currency: 'SCR' },
                { id: '3', userId, timestamp: new Date(), status: 'processed', amount: 30, currency: 'SCR' },
                { id: '4', userId, timestamp: new Date(), status: 'completed', amount: 20, currency: 'SCR' },
                { id: '5', userId, timestamp: new Date(), status: 'unknown', amount: 10, currency: 'SCR' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);
            const result = await service.getUserBalance(userId);

            expect(result).toEqual({
                userId,
                balance: 100, // (100 + 50) - 30 - 20
                earned: 150,  // 100 + 50
                spent: 30,    // 30
                payout: 20,   // 20
                paidOut: 20,  // 20
                currency: 'SCR',
            });
            expect(mockRepository.findTransactions).toHaveBeenCalledWith({ userId });
            expect(mockLogger.warn).toHaveBeenCalledWith(`Unhandled transaction status: unknown for transaction 5`);
        });

        it('should handle transactions with all the same status', async () => {
            const userId = 'user123';
            const mockTransactions: Transaction[] = [
                { id: '1', userId, timestamp: new Date(), status: 'pending', amount: 100, currency: 'SCR' },
                { id: '2', userId, timestamp: new Date(), status: 'pending', amount: 200, currency: 'SCR' },
                { id: '3', userId, timestamp: new Date(), status: 'pending', amount: 300, currency: 'SCR' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);
            const result = await service.getUserBalance(userId);

            expect(result).toEqual({
                userId,
                balance: 600, // 100 + 200 + 300
                earned: 600,  // 100 + 200 + 300
                spent: 0,
                payout: 0,
                paidOut: 0,
                currency: 'SCR',
            });
        });

        it('should use the currency from the first transaction', async () => {
            const userId = 'user123';
            const mockTransactions: Transaction[] = [
                { id: '1', userId, timestamp: new Date(), status: 'pending', amount: 100, currency: 'USD' },
                { id: '2', userId, timestamp: new Date(), status: 'pending', amount: 200, currency: 'EUR' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);
            const result = await service.getUserBalance(userId);

            expect(result.currency).toBe('USD');
        });

        it('should handle transactions with mixed currencies (using first transaction currency)', async () => {
            const userId = 'user123';
            const mockTransactions: Transaction[] = [
                { id: '1', userId, timestamp: new Date(), status: 'pending', amount: 100, currency: 'USD' },
                { id: '2', userId, timestamp: new Date(), status: 'processed', amount: 30, currency: 'EUR' },
                { id: '3', userId, timestamp: new Date(), status: 'completed', amount: 20, currency: 'GBP' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);
            const result = await service.getUserBalance(userId);

            // Assert
            expect(result).toEqual({
                userId,
                balance: 50, // 100 - 30 - 20
                earned: 100,
                spent: 30,
                payout: 20,
                paidOut: 20,
                currency: 'USD', // Using first transaction's currency
            });
        });

        it('should throw an error when repository access fails', async () => {
            const userId = 'user123';
            const error = new Error('Database connection failed');
            mockRepository.findTransactions.mockRejectedValue(error);

            await expect(service.getUserBalance(userId)).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to get aggregated data for user ${userId}: ${error.message}`
            );
        });
    });

    describe('getAggregatedPayoutRequests', () => {
        it('should return an empty array when no payout transactions are found', async () => {
            // Arrange
            mockRepository.findTransactions.mockResolvedValue([]);

            // Act
            const result = await service.getAggregatedPayoutRequests();

            // Assert
            expect(result).toEqual([]);
            expect(mockRepository.findTransactions).toHaveBeenCalledWith({ status: 'completed' });
            expect(mockLogger.warn).toHaveBeenCalledWith('No payout transactions found');
        });

        it('should correctly aggregate payout amounts by user ID', async () => {
            // Arrange
            const mockTransactions = [
                { id: '1', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 100, currency: 'SCR' },
                { id: '2', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 200, currency: 'SCR' },
                { id: '3', userId: 'user2', timestamp: new Date(), status: 'completed', amount: 150, currency: 'SCR' },
                { id: '4', userId: 'user3', timestamp: new Date(), status: 'completed', amount: 75, currency: 'SCR' },
                { id: '5', userId: 'user2', timestamp: new Date(), status: 'completed', amount: 50, currency: 'SCR' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);

            // Act
            const result = await service.getAggregatedPayoutRequests();

            // Assert
            expect(result).toHaveLength(3); // 3 unique users
            expect(result).toEqual(
                expect.arrayContaining([
                    { userId: 'user1', payoutAmount: 300, currency: 'SCR' }, // 100 + 200
                    { userId: 'user2', payoutAmount: 200, currency: 'SCR' }, // 150 + 50
                    { userId: 'user3', payoutAmount: 75, currency: 'SCR' },  // 75
                ])
            );
            expect(mockRepository.findTransactions).toHaveBeenCalledWith({ status: 'completed' });
            expect(mockLogger.log).toHaveBeenCalledWith('Fetching requested payouts and aggregating by user');
            expect(mockLogger.log).toHaveBeenCalledWith('Successfully aggregated payout data for 3 users');
        });

        it('should handle transactions with missing currency by using default "SCR"', async () => {
            // Arrange
            const mockTransactions = [
                { id: '1', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 100, currency: undefined },
                { id: '2', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 200, currency: null },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);

            // Act
            const result = await service.getAggregatedPayoutRequests();

            // Assert
            expect(result).toEqual([
                { userId: 'user1', payoutAmount: 300, currency: 'SCR' },
            ]);
        });

        it('should handle transactions with different currencies for the same user (uses first currency)', async () => {
            // Arrange
            const mockTransactions = [
                { id: '1', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 100, currency: 'USD' },
                { id: '2', userId: 'user1', timestamp: new Date(), status: 'completed', amount: 200, currency: 'EUR' },
            ];
            mockRepository.findTransactions.mockResolvedValue(mockTransactions);

            // Act
            const result = await service.getAggregatedPayoutRequests();

            // Assert
            expect(result).toEqual([
                { userId: 'user1', payoutAmount: 300, currency: 'USD' },
            ]);
        });

        it('should throw an error when repository access fails', async () => {
            // Arrange
            const error = new Error('Database connection failed');
            mockRepository.findTransactions.mockRejectedValue(error);

            // Act & Assert
            await expect(service.getAggregatedPayoutRequests()).rejects.toThrow(error);
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Failed to get aggregated payout data: ${error.message}`
            );
        });
    });
});
