import { defineConfig } from '@mikro-orm/mysql';
import { User } from './src/entities/user.entity';
import { Resource } from './src/entities/resource.entity';
import { Availability } from './src/entities/availability.entity';
import { Booking } from './src/entities/booking.entity';

export default defineConfig({
  entities: [User, Resource, Availability, Booking],
  dbName: 'grillrentapi',
  user: 'your_db_user', // Substitua pelo seu usuário do MySQL
  password: 'your_db_password', // Substitua pela sua senha do MySQL
  host: '127.0.0.1',
  port: 3306,
});
