import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './transaction.repository';
import { TransactionController } from './transaction.controller';

@Module({
    imports: [
        HttpModule.register({
            timeout: 5000,
            maxRedirects: 5,
        }),
        ConfigModule.forRoot(),
        ScheduleModule.forRoot(),
    ],
    controllers: [TransactionController],
    providers: [
        TransactionService,
        TransactionRepository,
    ],
    exports: [TransactionService],
})

export class TransactionModule { }