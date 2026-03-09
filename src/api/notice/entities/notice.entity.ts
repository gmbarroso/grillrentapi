import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type NoticeWhatsappDeliveryStatus =
  | 'not_requested'
  | 'pending'
  | 'retrying'
  | 'sent'
  | 'failed'
  | 'skipped';

@Entity('notice')
export class Notice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column({ length: 255, nullable: true })
  subtitle: string;

  @Column('text')
  content: string;

  @Column({ type: 'boolean', default: false })
  sendViaWhatsapp: boolean;

  @Column({ type: 'varchar', length: 32, default: 'not_requested' })
  whatsappDeliveryStatus: NoticeWhatsappDeliveryStatus;

  @Column({ type: 'int', default: 0 })
  whatsappAttemptCount: number;

  @Column({ type: 'timestamp', nullable: true })
  whatsappLastAttemptAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  whatsappSentAt?: Date;

  @Column({ type: 'varchar', length: 128, nullable: true })
  whatsappProviderMessageId?: string;

  @Column({ type: 'text', nullable: true })
  whatsappLastError?: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
