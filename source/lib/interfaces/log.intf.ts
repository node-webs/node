import { RowDataPacket } from 'mysql2';

/**
 * app_logs 테이블의 기본 인터페이스
 */
export interface AppLog {
  id?: number;
  timestamp: Date | string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'FATAL';
  message: string;
  success: boolean | number; // DB(TINYINT)와 JS(boolean) 호환
  request_id?: string | null;
  ip?: string | null;
  status_code?: number | null;
  code?: string | null;
  stack?: string | null;
  meta?: Record<string, any> | null; // JSON 컬럼
}

/**
 * SELECT 쿼리 결과 타입 (mysql2 호환용)
 */
export interface AppLogRow extends AppLog, RowDataPacket {}
