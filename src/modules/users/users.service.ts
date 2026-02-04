import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
    const existingUser = await this.findBySupabaseId(createUserDto.supabase_user_id);
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

  async update(id: string, updateUserDto: UpdateUserDto, updatedBy?: string): Promise<User> {
    const user = await this.findById(id);

    Object.assign(user, updateUserDto);
    if (updatedBy) {
      user.updated_by = updatedBy;
    }

    return this.usersRepository.save(user);
  }

  async updateRole(id: string, role: UserRole, updatedBy: string): Promise<User> {
    const user = await this.findById(id);
    user.role = role;
    user.updated_by = updatedBy;
    return this.usersRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.usersRepository.update(id, {
      last_login_at: new Date(),
    });
  }

  async updateStatus(id: string, status: UserStatus, updatedBy: string): Promise<User> {
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
      query.andWhere('user.daerah_id = :daerah_id', { daerah_id: filters.daerah_id });
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
