import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique, Index } from 'typeorm';

@Entity('organization_whatsapp_group_binding')
@Unique('UQ_org_whatsapp_group_binding_org_feature', ['organizationId', 'feature'])
export class OrganizationWhatsappGroupBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_org_whatsapp_group_binding_organizationId')
  @Column({ type: 'uuid' })
  organizationId: string;

  @Index('IDX_org_whatsapp_group_binding_integrationId')
  @Column({ type: 'uuid' })
  integrationId: string;

  @Column({ type: 'varchar', length: 64 })
  feature: string;

  @Column({ type: 'varchar', length: 191 })
  groupJid: string;

  @Column({ type: 'varchar', length: 180, nullable: true })
  groupName?: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
