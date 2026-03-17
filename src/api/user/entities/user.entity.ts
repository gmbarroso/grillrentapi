import { Entity, PrimaryGeneratedColumn, Column, Index, Unique } from 'typeorm';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export enum UserRole {
  ADMIN = 'admin',
  RESIDENT = 'resident',
}

@Entity()
@Unique(['organizationId', 'email'])
@Unique(['organizationId', 'apartment', 'block'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z\s]*$/, { message: 'Name can only contain letters and spaces' })
  name!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string | null;

  @Column()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])(?=\S+$).{8,100}$/, {
    message: 'Password must have at least 8 chars, one uppercase letter, one number, and one special character',
  })
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

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt?: Date | null;

  @Column({ type: 'boolean', default: false })
  mustChangePassword?: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true })
  pendingEmail?: string | null;

  @Index('IDX_user_emailVerificationTokenHash')
  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationTokenHash?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationExpiresAt?: Date | null;

  @Index('IDX_user_passwordResetTokenHash')
  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordResetTokenHash?: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  passwordResetExpiresAt?: Date | null;
}
