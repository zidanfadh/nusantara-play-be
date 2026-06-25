import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SupabaseService, SupabaseUser } from '../supabase';
import { DaerahService } from '../daerah/daerah.service';
import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { EmailService } from '../notifications';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private daerahService: DaerahService,
    private supabaseService: SupabaseService,
    private emailService: EmailService,
  ) {}

  async findBySupabaseId(supabaseUserId: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { supabase_user_id: supabaseUserId },
    });
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async createFromSupabase(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.findBySupabaseId(
      createUserDto.supabase_user_id,
    );
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const user = this.usersRepository.create({
      ...createUserDto,
      role: UserRole.PUBLIK, // Default role
      status: UserStatus.ACTIVE,
    });

    return this.usersRepository.save(user);
  }

  async syncFromSupabase(supabaseUser: SupabaseUser): Promise<User> {
    // Determine full_name with fallbacks
    const fullName =
      supabaseUser.full_name ||
      supabaseUser.name ||
      supabaseUser.user_metadata?.full_name ||
      supabaseUser.user_metadata?.name ||
      supabaseUser.email?.split('@')[0] ||
      '';

    // Map Supabase user to CreateUserDto
    const userData: CreateUserDto = {
      supabase_user_id: supabaseUser.id,
      email: supabaseUser.email || '',
      full_name: fullName,
      phone: supabaseUser.phone || undefined,
      avatar_url:
        supabaseUser.avatar_url || supabaseUser.user_metadata?.avatar_url,
    };

    // Check if user exists
    const existingUser = await this.findBySupabaseId(supabaseUser.id);

    if (existingUser) {
      // Update existing user
      return this.update(existingUser.id, userData);
    } else {
      // Create new user
      return this.createFromSupabase(userData);
    }
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    updatedBy?: string,
  ): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);
    if (updatedBy) {
      user.updated_by = updatedBy;
    }

    return this.usersRepository.save(user);
  }

  async updateRole(
    id: string,
    role: UserRole,
    updatedBy: string,
    daerahId?: string,
  ): Promise<User> {
    const user = await this.findById(id);

    if (role === UserRole.KURATOR_DAERAH) {
      if (!daerahId) {
        throw new BadRequestException(
          'daerah_id is required for kurator_daerah role',
        );
      }

      try {
        await this.daerahService.findById(daerahId);
      } catch {
        throw new BadRequestException(`Invalid daerah_id: ${daerahId}`);
      }

      user.daerah_id = daerahId;
    } else {
      user.daerah_id = null;
    }

    user.role = role;
    user.updated_by = updatedBy;
    return this.usersRepository.save(user);
  }

  async createByAdmin(
    dto: AdminCreateUserDto,
    createdBy: string,
  ): Promise<User> {
    const existingUser = await this.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const role = dto.role || UserRole.PUBLIK;
    const status = dto.status || UserStatus.ACTIVE;
    let daerahId: string | null = null;

    if (role === UserRole.KURATOR_DAERAH) {
      if (!dto.daerah_id) {
        throw new BadRequestException(
          'daerah_id is required for kurator_daerah role',
        );
      }

      try {
        await this.daerahService.findById(dto.daerah_id);
      } catch {
        throw new BadRequestException(`Invalid daerah_id: ${dto.daerah_id}`);
      }

      daerahId = dto.daerah_id;
    }

    const shouldSendEmail =
      dto.send_email === true && this.emailService.isCredentialEmailEnabled();

    if (shouldSendEmail) {
      this.emailService.assertConfigured();
    }

    let supabaseUser: SupabaseUser;
    try {
      supabaseUser = await this.supabaseService.createUser({
        email: dto.email,
        password: dto.password,
        full_name: dto.full_name,
        email_confirm: true,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create user';
      throw new BadRequestException(message);
    }

    const user = this.usersRepository.create({
      supabase_user_id: supabaseUser.id,
      email: dto.email,
      full_name: dto.full_name,
      phone: dto.phone,
      institution: dto.institution,
      role,
      status,
      daerah_id: daerahId,
      created_by: createdBy,
      updated_by: createdBy,
    });

    const savedUser = await this.usersRepository.save(user);

    if (shouldSendEmail) {
      await this.emailService.sendAdminCreatedUserCredentials({
        to: dto.email,
        fullName: dto.full_name,
        email: dto.email,
        password: dto.password,
      });
    }

    return savedUser;
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      last_login_at: new Date(),
    });
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    updatedBy: string,
  ): Promise<User> {
    const user = await this.findById(id);
    user.status = status;
    user.updated_by = updatedBy;
    return this.usersRepository.save(user);
  }

  async findAll(filters?: {
    role?: UserRole;
    status?: UserStatus;
    daerah_id?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: User[];
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

    const query = this.usersRepository.createQueryBuilder('user');

    if (filters?.role) {
      query.andWhere('user.role = :role', { role: filters.role });
    }

    if (filters?.status) {
      query.andWhere('user.status = :status', { status: filters.status });
    }

    if (filters?.daerah_id) {
      query.andWhere('user.daerah_id = :daerah_id', {
        daerah_id: filters.daerah_id,
      });
    }

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

  async count(): Promise<number> {
    return this.usersRepository.count();
  }
}
