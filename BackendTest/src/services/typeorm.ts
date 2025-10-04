import { DataSource } from 'typeorm';
import dotenv from 'dotenv';

dotenv.config();

// Supabase PostgreSQL connection string
const DATABASE_URL = 'postgresql://postgres:Casa8301@db.ujbhmfujhjiuapvegstg.supabase.co:5432/postgres';

// TypeORM DataSource configuration
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  entities: [__dirname + '/entities/*.ts'],
  synchronize: true, // Auto-create tables
  logging: false,
});

// Initialize database connection
export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log('✅ TypeORM connected to Supabase successfully');
    return true;
  } catch (error) {
    console.error('❌ TypeORM connection failed:', error);
    return false;
  }
};

// Close database connection
export const closeDatabase = async () => {
  try {
    await AppDataSource.destroy();
    console.log('✅ TypeORM connection closed');
  } catch (error) {
    console.error('❌ Error closing TypeORM connection:', error);
  }
};
