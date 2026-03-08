import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Booking } from '../../booking/entities/booking.entity';

@Entity()
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  type!: string;

  @Column({ type: 'uuid', nullable: true })
  organizationId?: string;
  
  @Column({ type: 'varchar', length: 160, nullable: true })
  description?: string | null;

  @OneToMany(() => Booking, booking => booking.resource)
  bookings!: Booking[];
}
