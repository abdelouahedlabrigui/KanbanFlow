import oracledb from 'oracledb';
import dotenv from 'dotenv';

dotenv.config();

let pool: oracledb.Pool | null = null;


oracledb.fetchAsString = [ oracledb.CLOB ];

export async function initializePool(): Promise<void> {
  try {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    oracledb.autoCommit = true;

    pool = await oracledb.createPool({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
      poolMin: 2,
      poolMax: 10,
      poolIncrement: 1,
      privilege: oracledb.SYSDBA
    });

    console.log('✅ Oracle DB pool initialized');
  } catch (err) {
    console.error('❌ Oracle DB pool initialization failed:', err);
    throw err;
  }
}

export async function getConnection(): Promise<oracledb.Connection> {
  if (!pool) throw new Error('DB pool not initialized');
  return pool.getConnection();
}

export async function execute<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = [],
  options: oracledb.ExecuteOptions = {}
): Promise<oracledb.Result<T>> {
  const conn = await getConnection();
  try {
    const result = await conn.execute<T>(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      ...options,
    });
    return result;
  } finally {
    await conn.close();
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.close(10);
    pool = null;
  }
}
