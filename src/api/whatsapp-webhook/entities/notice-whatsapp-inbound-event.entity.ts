import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('notice_whatsapp_inbound_event')
@Unique('UQ_notice_whatsapp_inbound_event_org_msg', ['organizationId', 'providerMessageId'])
export class NoticeWhatsappInboundEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_notice_whatsapp_inbound_event_org_created')
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  providerEvent?: string | null;

  @Index('IDX_notice_whatsapp_inbound_event_provider_message_id')
  @Column({ type: 'varchar', length: 191 })
  providerMessageId: string;

  @Column({ type: 'varchar', length: 191 })
  groupJid: string;

  @Column({ type: 'varchar', length: 191, nullable: true })
  senderJid?: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  senderName?: string | null;

  @Column({ type: 'text', nullable: true })
  messageText?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  messageTimestamp?: Date | null;

  @Column({ type: 'boolean', default: false })
  processedAsNotice: boolean;

  @Column({ type: 'uuid', nullable: true })
  noticeId?: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  ignoredReason?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  rawPayload?: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
