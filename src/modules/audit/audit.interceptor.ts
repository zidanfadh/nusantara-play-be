import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, method, url, ip, body } = request;
    const userAgent = request.get('user-agent') || '';

    // Determine action based on HTTP method
    const actionMap = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    const action = actionMap[method] || method;

    return next.handle().pipe(
      tap((data) => {
        // Only log mutations (POST, PUT, PATCH, DELETE)
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          // Extract entity info from URL (simple heuristic)
          const pathParts = url.split('/').filter(Boolean);
          const entityType = pathParts[0] || 'unknown';
          const entityId = data?.id || body?.id || null;

          this.auditService.log({
            user_id: user?.id,
            action,
            entity_type: entityType,
            entity_id: entityId,
            changes: body,
            ip_address: ip,
            user_agent: userAgent,
          });
        }
      }),
    );
  }
}
