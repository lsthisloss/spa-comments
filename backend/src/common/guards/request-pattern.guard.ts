import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Socket } from 'socket.io';

//Гвард для защиты от подозрительных паттернов запросов.
@Injectable()
export class RequestPatternGuard implements CanActivate {
  private readonly requestPatterns = new Map<
    string,
    {
      timestamps: number[];
      endpoints: string[];
      ipAddresses: Set<string>;
    }
  >();

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();
    type ClientData = { user?: { id?: string } };
    const data = client.data as ClientData;
    const userId = data.user?.id;
    const endpoint = context.getHandler().name;
    const ip = client.handshake?.address || 'unknown';

    if (!userId) return true; // Skip for unauthenticated

    // Get or create user pattern data
    let patternData = this.requestPatterns.get(userId);
    if (!patternData) {
      patternData = {
        timestamps: [],
        endpoints: [],
        ipAddresses: new Set([ip]),
      };
      this.requestPatterns.set(userId, patternData);
    }

    // Record this request
    const now = Date.now();
    patternData.timestamps.push(now);
    patternData.endpoints.push(endpoint);
    patternData.ipAddresses.add(ip);

    // Keep only last 100 requests
    if (patternData.timestamps.length > 100) {
      patternData.timestamps.shift();
      patternData.endpoints.shift();
    }

    // Analyze patterns
    const isAttack = this.analyzePatterns(userId, patternData, ip);

    return !isAttack;
  }

  private analyzePatterns(
    userId: string,
    data: {
      timestamps: number[];
      endpoints: string[];
      ipAddresses: Set<string>;
    },
    currentIp: string,
  ): boolean {
    // 1. Detect rapid fire requests (more than 20 in 5 seconds)
    const fiveSecondsAgo = Date.now() - 5000;
    const recentRequests = data.timestamps.filter((t) => t > fiveSecondsAgo);
    if (recentRequests.length > 20) {
      console.warn(
        `[RequestPatternGuard] Rapid fire detected for user ${userId} from IP ${currentIp}`,
      );
      return true;
    }

    // 2. Detect suspicious location changes (multiple IPs in short time)
    if (data.ipAddresses.size > 3) {
      console.warn(
        `[RequestPatternGuard] Multiple IPs detected for user ${userId}, current IP: ${currentIp}`,
      );
      return true;
    }

    // 3. Detect endpoint hammering (same endpoint repeatedly)
    const endpointCounts = data.endpoints.reduce<Record<string, number>>(
      (acc, endpoint) => {
        acc[endpoint] = (acc[endpoint] || 0) + 1;
        return acc;
      },
      {},
    );

    const hammeredEndpoint = Object.entries(endpointCounts).find(
      ([, count]) => count > 15,
    );

    if (hammeredEndpoint) {
      console.warn(
        `[RequestPatternGuard] Endpoint hammering detected: ${hammeredEndpoint[0]} from IP ${currentIp}`,
      );
      return true;
    }

    return false;
  }
}
