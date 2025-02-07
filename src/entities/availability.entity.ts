import { Entity, PrimaryKey, Property, ManyToOne } from '@mikro-orm/core';
import { Resource } from './resource.entity';

@Entity()
export class Availability {
  @PrimaryKey()
  id: number;

  @ManyToOne()
  resource: Resource;

  @Property()
  date: Date;

  @Property({ default: true })
  isAvailable: boolean;
}
