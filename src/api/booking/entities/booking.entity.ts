import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Booking {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  userId!: string;

  @Column()
  resourceId!: string;

  @Column()
  startTime!: Date;

  @Column()
  endTime!: Date;
}
