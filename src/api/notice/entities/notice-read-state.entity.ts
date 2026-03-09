import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

@Entity('notice_read_state')
@Unique('UQ_notice_read_state_user_org', ['userId', 'organizationId'])
@Index('IDX_notice_read_state_org_user', ['organizationId', 'userId'])
export class NoticeReadState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  organizationId: string;

  @Column({ type: 'timestamp', nullable: true })
  lastSeenNoticesAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
