import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class RevokedToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  token: string;

  @Column()
  expirationDate: Date;
}