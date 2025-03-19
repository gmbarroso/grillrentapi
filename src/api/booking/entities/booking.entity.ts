import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Resource } from '../../resource/entities/resource.entity';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  resourceId!: string;

  @Column()
  startTime!: Date;

  @Column()
  endTime!: Date;

  @Column()
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Resource)
  @JoinColumn({ name: 'resourceId' })
  resource!: Resource;

  @Column({ default: false })
  needTablesAndChairs!: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true })
  bookedOnBehalf?: string;
}
