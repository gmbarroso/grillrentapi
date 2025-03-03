import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

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
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z\s]*$/, { message: 'Name can only contain letters and spaces' })
  name!: string;

  @Column()
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @Column()
  @MinLength(8)
  @MaxLength(20)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/, { message: 'Password must be at least 8 characters long and contain both letters and numbers' })
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
