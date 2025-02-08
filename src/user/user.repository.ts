import { Injectable } from '@nestjs/common';
import { User } from '../entities/user.entity';

@Injectable()
export class UserRepository {
  private users: User[] = [];

  async create(user: Partial<User>): Promise<User> {
    const newUser = { id: Date.now(), ...user } as User;
    this.users.push(newUser);
    console.log('Created user:', newUser);
    return newUser;
  }

  async findAll(): Promise<User[]> {
    return this.users;
  }

  async findOne(id: number): Promise<User> {
    const user = this.users.find(user => user.id === id);
    if (!user) {
      throw new Error(`User with id ${id} not found`);
    }
    return user;
  }

  async findByEmail(email: string): Promise<User> {
    const user = this.users.find(user => user.email === email);
    if (!user) {
      throw new Error(`User with email ${email} not found`);
    }
    return user;
  }

  async update(id: number, user: Partial<User>): Promise<User> {
    const index = this.users.findIndex(user => user.id === id);
    if (index === -1) {
      throw new Error(`User with id ${id} not found`);
    }
    this.users[index] = { ...this.users[index], ...user };
    return this.users[index];
  }

  async remove(id: number): Promise<void> {
    this.users = this.users.filter(user => user.id !== id);
  }
}
