import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { User } from './user.entity';
import { Resource } from './resource.entity';

@Entity()
export class Booking {
  @PrimaryKey()
  id: number;

  @ManyToOne()
  user: User;

  @ManyToOne()
  resource: Resource;

  @Property()
  startDate: Date;

  @Property()
  endDate: Date;
}
