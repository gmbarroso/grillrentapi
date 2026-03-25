import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

export type ContactEmailDeliveryMode = 'in_app_only' | 'in_app_and_email';
export type ContactEmailReplyToMode = 'resident_email' | 'custom';

@Entity('organization_contact_email_settings')
@Unique('UQ_org_contact_email_settings_organization', ['organizationId'])
export class OrganizationContactEmailSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_org_contact_email_settings_organizationId')
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 32, default: 'in_app_only' })
  deliveryMode: ContactEmailDeliveryMode;

  @Column({ type: 'text', array: true, default: '{}' })
  recipientEmails: string[];

  @Column({ type: 'varchar', length: 120, nullable: true })
  fromName?: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  fromEmail?: string | null;

  @Column({ type: 'varchar', length: 24, default: 'resident_email' })
  replyToMode: ContactEmailReplyToMode;

  @Column({ type: 'varchar', length: 150, nullable: true })
  customReplyTo?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
