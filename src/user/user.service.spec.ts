import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { User } from '../entities/user.entity';

describe('UserService', () => {
  let service: UserService;
  let repository: UserRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, UserRepository],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a user', async () => {
    const user = { name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    jest.spyOn(repository, 'create').mockResolvedValue(user as any);
    expect(await service.create(user)).toEqual(user);
  });

  it('should find all users', async () => {
    const users = [
      { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' },
      { id: 2, name: 'Jane Doe', email: 'jane.doe@example.com', password: 'password123', apartment: '102' },
    ];
    jest.spyOn(repository, 'findAll').mockResolvedValue(users as any);
    expect(await service.findAll()).toEqual(users);
  });

  it('should find one user by id', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    jest.spyOn(repository, 'findOne').mockResolvedValue(user as any);
    expect(await service.findOne(1)).toEqual(user);
  });

  it('should find one user by email', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    jest.spyOn(repository, 'findByEmail').mockResolvedValue(user as any);
    expect(await service.findByEmail('john.doe@example.com')).toEqual(user);
  });

  it('should update a user', async () => {
    const user = { id: 1, name: 'John Doe', email: 'john.doe@example.com', password: 'password123', apartment: '101' };
    const updatedUser = { name: 'John Updated' };
    jest.spyOn(repository, 'update').mockResolvedValue({ ...user, ...updatedUser } as any);
    expect(await service.update(1, updatedUser)).toEqual({ ...user, ...updatedUser });
  });

  it('should remove a user', async () => {
    jest.spyOn(repository, 'remove').mockResolvedValue(undefined);
    expect(await service.remove(1)).toBeUndefined();
  });
});
