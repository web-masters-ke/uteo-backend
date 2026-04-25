import { Injectable, OnModuleInit, OnModuleDestroy, Logger, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * HMR-aware Prisma singleton.
 *
 * The bug: `nest start --watch` (and ts-node-dev) reloads the module graph on
 * every file change. Each reload runs the NestJS module bootstrap again, which
 * builds a fresh DI container and — without the globalThis cache below —
 * instantiates a brand new PrismaClient. The old client's sockets don't
 * always close cleanly before the new one opens more, so connections leak
 * until Postgres hits `max_connections` and starts rejecting queries with
 * "too many clients already" (surfaces as 500s).
 *
 * The fix: cache the PrismaClient on `globalThis` in dev. Node preserves the
 * global object across HMR, so we reuse the same connection pool instead of
 * leaking. In production we don't cache — each deploy gets a fresh client,
 * and the single long-lived process handles its own lifecycle cleanly.
 *
 * The constructor trick: returning an object from a JS constructor replaces
 * `this`. So when NestJS instantiates PrismaService in dev, we short-circuit
 * back to the cached client — DI keeps working, but there's only ever one
 * real PrismaClient.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prisma__: PrismaClient | undefined;
}

const isDev = process.env.NODE_ENV !== 'production';

function buildPrismaClient(): PrismaClient {
  return new PrismaClient({
    // 'query' is too noisy — enable only when debugging
    log: isDev ? ['error', 'warn'] : ['error'],
    errorFormat: 'minimal',
  });
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // In dev: reuse the globalThis-cached client across HMR reloads.
    if (isDev && globalThis.__prisma__) {
      // Returning an object from a constructor replaces `this` in the caller.
      // DI receives the cached singleton instead of a fresh leak-prone client.
      return globalThis.__prisma__ as unknown as PrismaService;
    }

    super({
      log: isDev ? ['error', 'warn'] : ['error'],
      errorFormat: 'minimal',
    });

    if (isDev) {
      globalThis.__prisma__ = this as unknown as PrismaClient;
    }
  }

  async onModuleInit() {
    // $connect is lazy — Prisma connects on first query by default.
    // Calling it here surfaces any DSN/auth issues at boot instead of on the first request.
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (err) {
      this.logger.error(`Prisma connection failed: ${(err as Error).message}`);
      throw err;
    }
  }

  async onModuleDestroy() {
    // In dev: DO NOT disconnect. The module is tearing down because HMR is
    // reloading — the next bootstrap will reuse this same client via globalThis.
    // Disconnecting here is what caused the leak: we'd drop connections
    // while new ones pile up, and sometimes the disconnect never completes.
    if (isDev) {
      this.logger.debug('Prisma disconnect skipped (dev mode — cached for HMR)');
      return;
    }
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /**
   * Wires POSIX signal handlers so Ctrl+C / `docker stop` cleanly closes
   * the connection pool in production. Call from main.ts after app creation.
   */
  async enableShutdownHooks(app: INestApplication) {
    const shutdown = async (sig: string) => {
      this.logger.log(`Received ${sig}, shutting down gracefully...`);
      try {
        await app.close();
        await this.$disconnect();
      } catch (err) {
        this.logger.error(`Shutdown error: ${(err as Error).message}`);
      } finally {
        process.exit(0);
      }
    };
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  }
}
