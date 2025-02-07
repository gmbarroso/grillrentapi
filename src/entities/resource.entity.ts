import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Resource {
  @PrimaryKey()
  id: number;

  @Property()
  type: 'grill' | 'tennis';

  @Property()
  name: string;
}
