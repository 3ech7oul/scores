import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MockModule } from './mock/mock.module';
import { TransactionModule } from './transaction/transaction.module';

@Module({
  imports: [MockModule, TransactionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
