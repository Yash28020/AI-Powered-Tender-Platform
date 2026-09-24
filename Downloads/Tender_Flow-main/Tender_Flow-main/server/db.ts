import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'tenderflow',
  password: String(process.env.DB_PASSWORD || ""), 
  port: Number(process.env.DB_PORT) || 5432,
});

export const query = (text: string, params?: any[]) => {
  console.log('[DB_QUERY] Executing:', text);
  return pool.query(text, params);
};