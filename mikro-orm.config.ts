import { Options } from '@mikro-orm/core';

const config: Options = {
  entities: ['./dist/entities'],
  entitiesTs: ['./src/entities'],
  dbName: 'grillrentapi',
  type: 'mysql',
  user: 'your_db_user',
  password: 'your_db_password',
};

export default config;
