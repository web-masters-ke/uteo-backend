/**
 * Supplementary seed — fills demo-critical tables without wiping anything.
 * Targets: Invoice, Payment, Payout, Subscription, WalletTransaction,
 *          LedgerEntry, CommissionRecord, DisputeComment, CommissionRule(+).
 *
 * Safe to re-run: checks existing counts and only adds if below threshold.
 */
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

function rnd<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function daysAgo(n: number) { return new Date(Date.now() - n * 86400_000); }
function hoursAgo(n: number) { return new Date(Date.now() - n * 3600_000); }

async function main() {
  console.log('→ Gap-filling demo data...');

  const bookings = await prisma.booking.findMany({
    include: { client: true, trainer: true, escrow: true },
  });
  const users = await prisma.user.findMany();
  const admin = users.find(u => u.role === 'SUPER_ADMIN')!;
  const clients = users.filter(u => u.role === 'CLIENT');
  const trainers = users.filter(u => u.role === 'TRAINER');
  const wallets = await prisma.wallet.findMany();
  const plans = await prisma.subscriptionPlan.findMany();
  const rules = await prisma.commissionRule.findMany();

  // ── Payments (one per non-cancelled booking + some standalone) ────────
  const existingPayments = await prisma.payment.count();
  if (existingPayments < 30) {
    for (const b of bookings) {
      if (b.status === 'CANCELLED' || b.status === 'PENDING_PAYMENT') continue;
      await prisma.payment.create({
        data: {
          userId: b.clientId,
          amount: b.amount,
          currency: 'KES',
          provider: rnd(['MPESA', 'CARD', 'BANK_TRANSFER'] as const),
          providerReference: `MPE-${Date.now()}-${rndInt(1000, 9999)}`,
          status: 'SUCCESS',
          metadata: { bookingId: b.id, channel: 'booking' },
          createdAt: b.createdAt,
        } as any,
      });
    }
    // Plus 15 course-purchase / top-up payments
    for (let i = 0; i < 15; i++) {
      const c = rnd(clients);
      await prisma.payment.create({
        data: {
          userId: c.id,
          amount: new Prisma.Decimal(rndInt(500, 8000)),
          currency: 'KES',
          provider: rnd(['MPESA', 'CARD'] as const),
          providerReference: `TOP-${Date.now()}-${i}`,
          status: rnd(['SUCCESS', 'SUCCESS', 'SUCCESS', 'PENDING', 'FAILED'] as const),
          metadata: { channel: rnd(['wallet_topup', 'course_purchase']) },
          createdAt: daysAgo(rndInt(1, 60)),
        } as any,
      });
    }
    console.log('  ✓ Payments seeded');
  }

  // ── Invoices (one per non-pending booking) ─────────────────────────────
  const existingInvoices = await prisma.invoice.count();
  if (existingInvoices < 20) {
    let n = 1;
    for (const b of bookings) {
      if (b.status === 'PENDING_PAYMENT') continue;
      const tax = Number(b.amount) * 0.16;
      const total = Number(b.amount) + tax;
      await prisma.invoice.create({
        data: {
          invoiceNumber: `INV-2026-${String(n++).padStart(4, '0')}`,
          issuerId: b.trainerId,
          recipientId: b.clientId,
          bookingId: b.id,
          amount: b.amount,
          tax: new Prisma.Decimal(tax.toFixed(2)),
          total: new Prisma.Decimal(total.toFixed(2)),
          currency: 'KES',
          status: b.status === 'COMPLETED' ? 'PAID' : b.status === 'CANCELLED' ? 'VOID' : 'SENT',
          description: `Training session invoice — booking ${b.id.slice(0, 8)}`,
          lineItems: [
            { description: 'Training session', quantity: 1, unitPrice: Number(b.amount), total: Number(b.amount) },
            { description: 'VAT (16%)', quantity: 1, unitPrice: tax, total: tax },
          ],
          issuedAt: b.createdAt,
          dueDate: new Date(b.createdAt.getTime() + 7 * 86400_000),
          paidAt: b.status === 'COMPLETED' ? new Date(b.createdAt.getTime() + 2 * 86400_000) : null,
        } as any,
      });
    }
    console.log('  ✓ Invoices seeded');
  }

  // ── Payouts (12 across trainers, mix of statuses) ──────────────────────
  const existingPayouts = await prisma.payout.count();
  if (existingPayouts < 10) {
    for (let i = 0; i < 15; i++) {
      const t = rnd(trainers);
      const amount = rndInt(3000, 25000);
      const fee = Math.round(amount * 0.02);
      const status = rnd(['COMPLETED', 'COMPLETED', 'COMPLETED', 'PROCESSING', 'APPROVED', 'REQUESTED', 'FAILED'] as const);
      await prisma.payout.create({
        data: {
          userId: t.id,
          amount: new Prisma.Decimal(amount),
          fee: new Prisma.Decimal(fee),
          netAmount: new Prisma.Decimal(amount - fee),
          currency: 'KES',
          method: rnd(['MPESA', 'BANK_TRANSFER'] as const),
          status,
          destination: rnd(['MPESA:+254712345678', 'BANK:KCB:01234567', 'MPESA:+254722000000']),
          reference: `PAY-${Date.now()}-${i}`,
          processedAt: status === 'COMPLETED' ? daysAgo(rndInt(1, 30)) : null,
          approvedBy: status !== 'REQUESTED' ? admin.id : null,
          rejectedReason: status === 'FAILED' ? rnd(['Invalid M-Pesa number', 'Bank details mismatch', 'Insufficient KYC']) : null,
          createdAt: daysAgo(rndInt(1, 60)),
        } as any,
      });
    }
    console.log('  ✓ Payouts seeded');
  }

  // ── Subscriptions (8 trainers on plans) ────────────────────────────────
  const existingSubs = await prisma.subscription.count();
  if (existingSubs < 5 && plans.length) {
    for (let i = 0; i < 10; i++) {
      const t = rnd(trainers);
      const plan = rnd(plans);
      const start = daysAgo(rndInt(5, 60));
      const end = new Date(start.getTime() + (plan.durationDays || 30) * 86400_000);
      const status = end < new Date()
        ? rnd(['EXPIRED', 'ACTIVE'] as const)
        : rnd(['ACTIVE', 'ACTIVE', 'ACTIVE', 'CANCELLED', 'SUSPENDED'] as const);
      await prisma.subscription.create({
        data: {
          userId: t.id,
          planId: plan.id,
          startDate: start,
          endDate: end,
          status,
          autoRenew: Math.random() > 0.4,
        } as any,
      }).catch(() => { /* unique constraint on userId+planId maybe */ });
    }
    console.log('  ✓ Subscriptions seeded');
  }

  // ── Wallet transactions + ledger entries (double-entry) ────────────────
  const existingTx = await prisma.walletTransaction.count();
  if (existingTx < 40) {
    for (const b of bookings) {
      if (b.status !== 'COMPLETED') continue;
      const clientWallet = wallets.find(w => w.userId === b.clientId);
      const trainerWallet = wallets.find(w => w.userId === b.trainerId);
      if (!clientWallet || !trainerWallet) continue;
      const tx = await prisma.walletTransaction.create({
        data: {
          referenceType: 'BOOKING_PAYMENT',
          referenceId: b.id,
          description: `Payment for booking ${b.id.slice(0, 8)}`,
        } as any,
      });
      await prisma.ledgerEntry.createMany({
        data: [
          { walletId: clientWallet.id, transactionId: tx.id, entryType: 'DEBIT', amount: b.amount } as any,
          { walletId: trainerWallet.id, transactionId: tx.id, entryType: 'CREDIT', amount: b.amount } as any,
        ],
      });
    }
    // A few top-ups (credit only into client wallets)
    for (let i = 0; i < 20; i++) {
      const w = rnd(wallets);
      const tx = await prisma.walletTransaction.create({
        data: {
          referenceType: 'TOPUP',
          description: rnd(['M-Pesa top-up', 'Card deposit', 'Bank transfer']),
        } as any,
      });
      await prisma.ledgerEntry.create({
        data: { walletId: w.id, transactionId: tx.id, entryType: 'CREDIT', amount: new Prisma.Decimal(rndInt(500, 15000)) } as any,
      });
    }
    console.log('  ✓ Wallet transactions + ledger seeded');
  }

  // ── Commission records (for every completed booking with escrow + rule) ──
  const existingCommissions = await prisma.commissionRecord.count();
  if (existingCommissions < 5 && rules.length) {
    const rule = rules[0];
    for (const b of bookings) {
      if (b.status !== 'COMPLETED' || !b.escrow) continue;
      const rate = Number(rule.commissionRate);
      const commissionAmount = Number(b.amount) * rate;
      const trainerPayout = Number(b.amount) - commissionAmount;
      await prisma.commissionRecord.create({
        data: {
          bookingId: b.id,
          escrowId: b.escrow.id,
          bookingAmount: b.amount,
          commissionRate: rule.commissionRate,
          commissionAmount: new Prisma.Decimal(commissionAmount.toFixed(2)),
          trainerPayoutAmount: new Prisma.Decimal(trainerPayout.toFixed(2)),
          ruleId: rule.id,
        } as any,
      }).catch(() => { /* unique on bookingId/escrowId */ });
    }
    console.log('  ✓ Commission records seeded');
  }

  // ── Dispute comments (add thread to existing disputes) ─────────────────
  const disputes = await prisma.dispute.findMany();
  const existingComments = await prisma.disputeComment.count();
  if (existingComments < 5) {
    for (const d of disputes) {
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id,
          authorId: d.raisedById,
          content: 'I want to raise this issue — the session was not delivered as agreed.',
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 5),
        } as any,
      });
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id,
          authorId: d.againstId,
          content: 'I dispute this claim — the session was fully delivered per the booking notes.',
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 30),
        } as any,
      });
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id,
          authorId: admin.id,
          content: 'Reviewing evidence — will reach out within 24h for follow-up.',
          isInternal: false,
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 60 * 2),
        } as any,
      });
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id,
          authorId: admin.id,
          content: 'Internal note: both parties have submitted evidence. Leaning toward partial refund.',
          isInternal: true,
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 60 * 3),
        } as any,
      });
    }
    console.log('  ✓ Dispute comments seeded');
  }

  // ── Add MORE disputes (the user complained only 1 dispute exists) ──────
  if (disputes.length < 5) {
    const completedBookings = bookings.filter(b => b.status === 'COMPLETED' || b.status === 'IN_PROGRESS').slice(0, 5);
    let addedDisputes = 0;
    for (const b of completedBookings) {
      if (addedDisputes >= 4) break;
      const d = await prisma.dispute.create({
        data: {
          bookingId: b.id,
          raisedById: rnd([b.clientId, b.trainerId]),
          againstId: rnd([b.clientId, b.trainerId]),
          reason: rnd([
            'Session not delivered as agreed',
            'Trainer did not show up',
            'Quality below expectations',
            'Client no-show — full session fee claim',
            'Late cancellation by client',
          ]),
          description: rnd([
            'The agreed curriculum was not followed and the session ended early.',
            'The trainer was 45 minutes late and cut the session short.',
            'Student did not prepare materials provided in advance.',
            'Materials promised in the session were never shared.',
            'Client cancelled 30 minutes before start — per policy, 50% fee applies.',
          ]),
          status: rnd(['OPEN', 'UNDER_REVIEW', 'OPEN', 'RESOLVED_REFUND', 'RESOLVED_RELEASE'] as const),
          createdAt: daysAgo(rndInt(1, 20)),
        } as any,
      });
      addedDisputes++;
      // Add a couple of comments to each
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id, authorId: d.raisedById,
          content: 'I strongly feel the outcome did not match what we agreed in the booking.',
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 10),
        } as any,
      });
      await prisma.disputeComment.create({
        data: {
          disputeId: d.id, authorId: admin.id,
          content: 'Acknowledged — opening internal review. Both parties will be contacted.',
          createdAt: new Date(d.createdAt.getTime() + 1000 * 60 * 60),
        } as any,
      });
    }
    console.log('  ✓ Extra disputes seeded');
  }

  // ── Update wallet balances from ledger totals (so numbers are real) ────
  for (const w of wallets) {
    const credits = await prisma.ledgerEntry.aggregate({
      where: { walletId: w.id, entryType: 'CREDIT' }, _sum: { amount: true },
    });
    const debits = await prisma.ledgerEntry.aggregate({
      where: { walletId: w.id, entryType: 'DEBIT' }, _sum: { amount: true },
    });
    const bal = Number(credits._sum.amount || 0) - Number(debits._sum.amount || 0);
    await prisma.wallet.update({ where: { id: w.id }, data: { balance: new Prisma.Decimal(bal.toFixed(2)) } });
  }
  console.log('  ✓ Wallet balances recomputed');

  // ── Final summary ──────────────────────────────────────────────────────
  const summary = {
    users: await prisma.user.count(),
    trainers: await prisma.trainerProfile.count(),
    bookings: await prisma.booking.count(),
    courses: await prisma.course.count(),
    lessons: await prisma.courseLesson.count(),
    payments: await prisma.payment.count(),
    payouts: await prisma.payout.count(),
    invoices: await prisma.invoice.count(),
    subscriptions: await prisma.subscription.count(),
    walletTx: await prisma.walletTransaction.count(),
    ledger: await prisma.ledgerEntry.count(),
    disputes: await prisma.dispute.count(),
    disputeComments: await prisma.disputeComment.count(),
    commissions: await prisma.commissionRecord.count(),
    reviews: await prisma.review.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('\nFinal counts:');
  console.table(summary);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
