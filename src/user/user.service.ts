import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from '../entities/user.entity';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(user: Partial<User>): Promise<User> {
    return this.userRepository.create(user);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findOne(id: number): Promise<User> {
    return this.userRepository.findOne(id);
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findByEmail(email);
  }

  async update(id: number, user: Partial<User>): Promise<User> {
    return this.userRepository.update(id, user);
  }

  async remove(id: number): Promise<void> {
    return this.userRepository.remove(id);
  }
}
