import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    name: string,
    email: string,
    passwordPlain: string,
  ): Promise<User> {
    const existing = await this.userRepository.findOneBy({
      email: email.toLowerCase(),
    });
    if (existing) {
      throw new ConflictException('Email address already registered');
    }

    const hashedPassword = await bcrypt.hash(passwordPlain, 10);
    const user = this.userRepository.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const saved = await this.userRepository.save(user);
    delete saved.password;
    return saved;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        createdAt: true,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });
  }

  async updateProfile(id: string, name: string): Promise<User | null> {
    await this.userRepository.update(id, { name });
    return this.findById(id);
  }
}
