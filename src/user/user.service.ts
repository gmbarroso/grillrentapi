import { Injectable } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from '../entities/user.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(user: Partial<User>): Promise<User> {
    // Hash the password before saving the user
    const hashedPassword = await bcrypt.hash(user.password, 10);
    console.log('Hashed password:', hashedPassword);
    user.password = hashedPassword;
    console.log('User object before saving:', user);
    const createdUser = await this.userRepository.create(user);
    console.log('Created user:', createdUser);
    return createdUser;
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async findOne(id: number): Promise<User> {
    console.log('Finding user with id:', id);
    const user = await this.userRepository.findOne(id);
    console.log('Found user:', user);
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findByEmail(email);
  }

  async update(id: number, user: Partial<User>): Promise<User> {
    // Hash the password only if it is being updated
    if (user.password) {
      user.password = await bcrypt.hash(user.password, 10);
    }
    return this.userRepository.update(id, user);
  }

  async remove(id: number): Promise<void> {
    return this.userRepository.remove(id);
  }
}
