import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { DepositDto, WithdrawDto, ListTransactionsDto } from './dto/wallet.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

class AdminFundDto {
  @IsString() userId: string;
  @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @IsOptional() @IsString() description?: string;
}

class TransferDto {
  @IsString() toUserId: string;
  @Type(() => Number) @IsNumber() @Min(1) amount: number;
  @IsOptional() @IsString() description?: string;
}

@Controller('wallet')
export class WalletController {
  constructor(private readonly svc: WalletService) {}
  @Get('me') getMyWallet(@CurrentUser('id') uid: string) { return this.svc.getMyWallet(uid); }
  @Get('balance') getBalance(@CurrentUser('id') uid: string) { return this.svc.getBalance(uid); }
  @Post('deposit') deposit(@CurrentUser('id') uid: string, @Body() dto: DepositDto) { return this.svc.deposit(uid, dto); }
  @Get('deposit/:paymentId/status') depositStatus(@CurrentUser('id') uid: string, @Param('paymentId') pid: string) { return this.svc.getDepositStatus(uid, pid); }
  @Post('withdraw') withdraw(@CurrentUser('id') uid: string, @Body() dto: WithdrawDto) { return this.svc.withdraw(uid, dto); }
  @Get('transactions') getTx(@CurrentUser('id') uid: string, @Query() dto: ListTransactionsDto) { return this.svc.getTransactions(uid, dto); }
  @Get('transactions/statement') getStatement(@CurrentUser('id') uid: string, @Query() dto: ListTransactionsDto) { return this.svc.getStatement(uid, dto); }
  @Get('transactions/:txId/receipt') getReceipt(@CurrentUser('id') uid: string, @Param('txId') txId: string) { return this.svc.getReceipt(uid, txId); }
  @Get('escrow/upcoming') getUpcomingEscrow(@CurrentUser('id') uid: string) { return this.svc.getUpcomingEscrowReleases(uid); }
  @Get('spending/insights') getInsights(@CurrentUser('id') uid: string, @Query() q: { months?: string }) { return this.svc.getSpendingInsights(uid, Number(q.months) || 6); }
  @Get('withdrawals') getWithdrawals(@CurrentUser('id') uid: string, @Query() q: { limit?: string }) { return this.svc.getWithdrawals(uid, Number(q.limit) || 20); }

  // Admin: fund any user's wallet
  @Post('admin/fund') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN')
  adminFund(@Body() dto: AdminFundDto) { return this.svc.adminFund(dto.userId, dto.amount, dto.description); }

  // Firm owner: transfer from own wallet to consultant's wallet
  @Post('transfer')
  transfer(@CurrentUser('id') uid: string, @Body() dto: TransferDto) { return this.svc.transfer(uid, dto.toUserId, dto.amount, dto.description); }

  // Admin: list all wallets
  @Get('admin/all') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN')
  listAll() { return this.svc.listAllWallets(); }

  // Admin: list all transactions across all users
  @Get('admin/transactions') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN')
  listAllTx(@Query('limit') limit?: string) { return this.svc.listAllTransactions(limit ? Number(limit) : 100); }

  @Get(':userId') @UseGuards(RolesGuard) @Roles('ADMIN','SUPER_ADMIN','FINANCE_ADMIN') getByUser(@Param('userId') uid: string) { return this.svc.getWalletByUserId(uid); }

  // Called on every app open — idempotent, only credits once
  @Post('starter-credit') claimStarter(@CurrentUser('id') uid: string) { return this.svc.claimStarterCredit(uid); }
}
