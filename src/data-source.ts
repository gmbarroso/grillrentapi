import { DataSource } from 'typeorm';
import { User } from './api/user/entities/user.entity';
import { Booking } from './api/booking/entities/booking.entity';
import { AddBlockToUsersxxxxxx } from './migration/AddBlockToUsers';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  entities: [User, Booking],
  migrations: [AddBlockToUsersxxxxxx],
  synchronize: false,
});
