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
    page?: number;
    limit?: number;
  }): Promise<{
    data: AuditLog[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

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
    query.skip(skip).take(limit);

    const [data, total] = await query.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  async findByEntity(
    entityType: string,
    entityId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll({
      entity_type: entityType,
      entity_id: entityId,
      page,
      limit,
    });
  }

  async findByUser(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    return this.findAll({ user_id: userId, page, limit });
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
