import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

export interface CreateAuditLogDto {
  user_id?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(dto: CreateAuditLogDto): Promise<AuditLog> {
    const auditLog = this.auditLogRepository.create(dto);
    return this.auditLogRepository.save(auditLog);
  }

  async findAll(filters?: {
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditLog[]> {
    const query = this.auditLogRepository.createQueryBuilder('audit_log');

    if (filters?.user_id) {
      query.andWhere('audit_log.user_id = :user_id', { user_id: filters.user_id });
    }

    if (filters?.entity_type) {
      query.andWhere('audit_log.entity_type = :entity_type', {
        entity_type: filters.entity_type,
      });
    }

    if (filters?.entity_id) {
      query.andWhere('audit_log.entity_id = :entity_id', {
        entity_id: filters.entity_id,
      });
    }

    if (filters?.action) {
      query.andWhere('audit_log.action = :action', { action: filters.action });
    }

    query.orderBy('audit_log.created_at', 'DESC');

    if (filters?.limit) {
      query.limit(filters.limit);
    }

    if (filters?.offset) {
      query.offset(filters.offset);
    }

    return query.getMany();
  }

  async findByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.findAll({ entity_type: entityType, entity_id: entityId });
  }

  async findByUser(userId: string, limit: number = 50): Promise<AuditLog[]> {
    return this.findAll({ user_id: userId, limit });
  }

  async count(filters?: {
    user_id?: string;
    entity_type?: string;
    entity_id?: string;
  }): Promise<number> {
    const query = this.auditLogRepository.createQueryBuilder('audit_log');

    if (filters?.user_id) {
      query.andWhere('audit_log.user_id = :user_id', { user_id: filters.user_id });
    }

    if (filters?.entity_type) {
      query.andWhere('audit_log.entity_type = :entity_type', {
        entity_type: filters.entity_type,
      });
    }

    if (filters?.entity_id) {
      query.andWhere('audit_log.entity_id = :entity_id', {
        entity_id: filters.entity_id,
      });
    }

    return query.getCount();
  }
}
