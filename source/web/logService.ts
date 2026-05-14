import  db from '../mysql-2'; // DB 연결 모듈 (예: mysql2, pg 등)
import { AppLog, AppLogRow } from '../intf/log.intf';

export const LogService = {
  // 1. 로그 저장 (INSERT)
  async saveLog(logData: AppLog) {
    const sql = `
      INSERT INTO app_logs (timestamp, level, message, success, request_id, ip, status_code, code, stack, meta)
      VALUES (NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // JSON 데이터는 문자열화할 필요 없이 객체 그대로 전달 (mysql2가 처리)
    const params = [
      logData.level, logData.message, logData.success ? 1 : 0,
      logData.request_id, logData.ip, logData.status_code,
      logData.code, logData.stack, JSON.stringify(logData.meta)
    ];

    return await db.execute(sql, params);
  },

  // 2. 에러 로그만 조회 (SELECT)
  async getErrorLogs(): Promise<AppLogRow[]> {
    const sql = "SELECT * FROM app_logs WHERE level = 'ERROR' ORDER BY timestamp DESC LIMIT 10";
    return await db.select<AppLogRow>(sql);
  }
};

/*
    타입 안전성:
    AppLogRow 인터페이스를 통해 조회된 데이터에 row.message, row.meta 등 자동완성이 지원됩니다.
    
    객체 지향적 에러 처리:
    구체적인 DB 에러(ER_DUP_ENTRY 등)는 로거에 남겨 개발자가 확인하게 하고,
    사용자에게는 DatabaseError를 통해 정제된 메시지만 전달합니다.
    
    JSON 처리:
    mysql2 사용 시 meta 컬럼에 객체를 넣을 때, 쿼리 방식에 따라 JSON.stringify()를 사용하거나
    라이브러리 설정을 확인하여 유연하게 대응할 수 있습니다.
*/