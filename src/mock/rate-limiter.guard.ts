import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Observable } from 'rxjs';

interface RateLimitInfo {
    requestCount: number;
    windowStart: number;
}

@Injectable()
export class RateLimiterGuard implements CanActivate {
    // Use a simple in-memory store for rate limiting
    private readonly requestLimits: Map<string, RateLimitInfo> = new Map();

    // Configure rate limit settings
    private readonly WINDOW_MS = 60 * 1000; // 1 minute in milliseconds
    private readonly MAX_REQUESTS_PER_WINDOW = 5; // 5 requests per minute

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request = context.switchToHttp().getRequest();
        const clientIp = request.ip || '127.0.0.1';

        const currentTime = Date.now();
        const clientRateInfo = this.requestLimits.get(clientIp) || {
            requestCount: 0,
            windowStart: currentTime,
        };

        // Reset window if it's expired
        if (currentTime - clientRateInfo.windowStart > this.WINDOW_MS) {
            clientRateInfo.requestCount = 0;
            clientRateInfo.windowStart = currentTime;
        }

        // Increment request count and check limit
        clientRateInfo.requestCount++;

        if (clientRateInfo.requestCount > this.MAX_REQUESTS_PER_WINDOW) {
            // Calculate time remaining until rate limit resets
            const resetTime = clientRateInfo.windowStart + this.WINDOW_MS;
            const timeToReset = Math.ceil((resetTime - currentTime) / 1000);

            throw new HttpException({
                statusCode: HttpStatus.TOO_MANY_REQUESTS,
                message: 'Rate limit exceeded. Try again later.',
                retryAfter: timeToReset,
            }, HttpStatus.TOO_MANY_REQUESTS);
        }

        // Update the rate limit info
        this.requestLimits.set(clientIp, clientRateInfo);

        return true;
    }
}