import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { MessageReply } from './message-reply.entity';

export type ContactMessageCategory = 'suggestion' | 'complaint' | 'question';
export type ContactMessageStatus = 'unread' | 'read' | 'replied';
export type MessageEmailDeliveryStatus = 'not_requested' | 'pending' | 'sent' | 'failed' | 'skipped';

@Entity('message')
@Index('IDX_message_org_created_at', ['organizationId', 'createdAt'])
@Index('IDX_message_org_status_created_at', ['organizationId', 'status', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  senderUserId: string;

  @Column({ length: 120 })
  senderName: string;

  @Column({ length: 150 })
  senderEmail: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  senderApartment?: string | null;

  @Column({ type: 'int', nullable: true })
  senderBlock?: number | null;

  @Column({ length: 255 })
  subject: string;

  @Column({ type: 'varchar', length: 32 })
  category: ContactMessageCategory;

  @Column('text')
  content: string;

  @Column({ type: 'simple-json', nullable: true })
  attachments?: string[] | null;

  @Column({ type: 'varchar', length: 32, default: 'unread' })
  status: ContactMessageStatus;

  @Column({ type: 'timestamp', nullable: true })
  readAt?: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  adminEmailDeliveryStatus: MessageEmailDeliveryStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  adminEmailProviderMessageId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  adminEmailSentAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  adminEmailLastError?: string | null;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;

  @OneToMany(() => MessageReply, (reply) => reply.message, { cascade: false })
  replies?: MessageReply[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
