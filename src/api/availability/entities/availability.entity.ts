import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Availability {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  resourceId: string;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;
}
