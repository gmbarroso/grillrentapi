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
  address?: string;

  @Column({ length: 150, nullable: true })
  email?: string;

  @Column({ length: 40, nullable: true })
  phone?: string;

  @Column({ type: 'text', nullable: true })
  businessHours?: string;

  @Column({ length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;

  @Column({ length: 5, nullable: true })
  openingTime?: string;

  @Column({ length: 5, nullable: true })
  closingTime?: string;

  @Column({ type: 'text', nullable: true })
  logoUrl?: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
