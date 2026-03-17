import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

export type WhatsappIntegrationStatus = 'connected' | 'disconnected';

@Entity('organization_whatsapp_integration')
@Unique('UQ_org_whatsapp_integration_organization', ['organizationId'])
export class OrganizationWhatsappIntegration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_org_whatsapp_integration_organizationId')
  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'varchar', length: 32, default: 'evolution' })
  provider: string;

  @Column({ type: 'text' })
  baseUrl: string;

  @Column({ type: 'varchar', length: 120 })
  instanceName: string;

  @Column({ type: 'text' })
  apiKey: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  whatsappNumber?: string | null;

  @Column({ type: 'boolean', default: false })
  autoSendNotices: boolean;

  @Column({ type: 'varchar', length: 24, default: 'disconnected' })
  status: WhatsappIntegrationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
