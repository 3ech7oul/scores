import { Module } from '@nestjs/common';
import { MockController } from './mock.controller';
import { MockService } from './mock.service';
import { RateLimiterGuard } from './rate-limiter.guard';

@Module({
    controllers: [MockController],
    providers: [MockService, RateLimiterGuard],
})

export class MockModule { }