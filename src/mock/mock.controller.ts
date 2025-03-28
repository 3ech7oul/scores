import { Controller, Get, Query, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { MockService } from './mock.service';
import { RateLimiterGuard } from './rate-limiter.guard';


@Controller('transactions')
@UseGuards(RateLimiterGuard)
export class MockController {
    private readonly DEFAULT_LIMIT = 3;
    private readonly MAX_TRANSACTIONS_LIMIT = 1000;

    constructor(private readonly mockService: MockService) { }

    @Get()
    async getTransactions(
        @Query('startDate') startDate: string,
        @Query('endDate') endDate: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = this.DEFAULT_LIMIT,
    ) {
        try {
            // Validate date format
            if (!this.isValidDateFormat(startDate) || !this.isValidDateFormat(endDate)) {
                throw new HttpException(
                    'Invalid date format. Use YYYY-MM-DD HH:MM:SS',
                    HttpStatus.BAD_REQUEST,
                );
            }

            if (limit > this.MAX_TRANSACTIONS_LIMIT) {
                limit = this.MAX_TRANSACTIONS_LIMIT;
            }


            return this.mockService.findAll(startDate, endDate, page, limit);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                'Failed to fetch transactions',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    private isValidDateFormat(dateString: string): boolean {
        // Check if the date string matches YYYY-MM-DD HH:MM:SS format
        const dateRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
        return dateRegex.test(dateString);
    }
}