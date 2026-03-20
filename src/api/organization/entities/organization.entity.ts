import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('organization')
@Unique(['slug'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 120 })
  name!: string;

  @Column({ length: 120 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ length: 150, nullable: true })
  email?: string | null;

  @Column({ length: 40, nullable: true })
  phone?: string | null;

  @Column({ type: 'text', nullable: true })
  businessHours?: string | null;

  @Column({ length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;

  @Column({ length: 5, nullable: true })
  openingTime?: string | null;

  @Column({ length: 5, nullable: true })
  closingTime?: string | null;

  @Column({ type: 'text', nullable: true })
  logoUrl?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
