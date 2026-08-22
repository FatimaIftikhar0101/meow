import { Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '../auth/jwt.strategy';

interface AuthenticatedSocket extends Socket {
  data: { userId?: string };
}

// CORS and transports come from ScalableIoAdapter, which applies the same
// allowlist the HTTP API uses. `cors: { origin: true }` used to sit here and
// reflected every origin that asked. See common/ws/ws-options.ts.
@WebSocketGateway({ namespace: '/transfers' })
export class TransfersGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(TransfersGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit() {
    this.logger.log('Transfers WebSocket namespace initialised');
  }

  handleConnection(client: AuthenticatedSocket) {
    try {
      const raw =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization;
      if (!raw) throw new UnauthorizedException();
      const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw;
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
      });
      client.data.userId = payload.sub;
      void client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitStatus(userId: string, transferId: string, status: string) {
    this.server
      .to(`user:${userId}`)
      .emit('transfer:status', { transferId, status });
  }
}
