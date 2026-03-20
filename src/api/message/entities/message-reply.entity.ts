import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Message, MessageEmailDeliveryStatus } from './message.entity';

export type MessageReplyOriginRole = 'admin' | 'resident';
export type MessageReplyOriginChannel = 'in_app' | 'email_inbound';

@Entity('message_reply')
@Index('IDX_message_reply_message_created_at', ['messageId', 'createdAt'])
@Index('IDX_message_reply_message_external_id', ['messageId', 'externalMessageId'])
export class MessageReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  messageId: string;

  @ManyToOne(() => Message, (message) => message.replies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'messageId' })
  message: Message;

  @Column({ type: 'uuid' })
  authorUserId: string;

  @Column({ length: 120 })
  authorName: string;

  @Column({ type: 'varchar', length: 16, default: 'admin' })
  originRole: MessageReplyOriginRole;

  @Column({ type: 'varchar', length: 24, default: 'in_app' })
  originChannel: MessageReplyOriginChannel;

  @Column('text')
  content: string;

  @Column({ type: 'boolean', default: false })
  sendViaEmail: boolean;

  @Column({ type: 'varchar', length: 32, default: 'not_requested' })
  emailDeliveryStatus: MessageEmailDeliveryStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  emailProviderMessageId?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailSentAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  emailLastError?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  externalMessageId?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
