import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  RESIDENT = 'resident',
}

@Entity()
@Unique(['email'])
@Unique(['apartment', 'block'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  email!: string;

  @Column()
  password!: string;

  @Column()
  apartment!: string;

  @Column()
  block!: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.RESIDENT,
  })
  role!: UserRole;
}
