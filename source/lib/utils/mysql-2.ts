import mysql, { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
// Promise를 지원하여 async/await 코딩이 가능
// RowDataPacket(조회 결과)과 ResultSetHeader(실행 결과) 타입

import logger from './logger';
import { DatabaseError } from '../errors/web.error';

const pool: Pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 3306,
    connectionLimit: 10, // 최대 10개의 연결을 미리 만들어두고 재사용
    waitForConnections: true, // 10개가 모두 사용 중일 때 새로운 요청이 오면 에러를 내지 않고 빈 자리가 날 때까지 기다림
    queueLimit: 0, // 대기열에 제한을 두지 않아 요청이 밀려도 차례대로 처리
    enableKeepAlive: true, // 연결 유지 옵션 추가 권장, 네트워크 환경에 따라 DB 연결이 예기치 않게 끊기는 것을 방지
    keepAliveInitialDelay: 10000
});

// 이벤트 리스너 (기존 코드 유지)
pool.on('enqueue', () => {
    // 11번째 동시 요청이 들어오는 순간 즉시 enqueue 이벤트가 발생
    // 서비스 운영 중 이 로그가 자주 찍힌다면 connectionLimit 수치를 늘리거나
    // 쿼리 성능을 개선해야 한다는 확실한 근거

    // console.warn 대신 Sentry나 Slack Webhook 등을 연결하면
    // 서버실에 앉아있지 않아도 DB 부하 상태를 즉시 알 수 있습니다.
    // console.warn(`[${new Date().toISOString()}] ⚠️ 경고: 모든 DB 연결이 사용 중입니다.`);
    logger.warn('⚠ DB 연결 풀 포화: 모든 연결이 사용 중입니다. 대기열 생성됨.');
});

pool.on('connection', (connection) => {
    // 연결이 새로 만들어졌을 때 알림
    // console.log(`[${new Date().toISOString()}] 🔌 신규 연결 생성 (ID: ${connection.threadId})`);
    logger.info(`🔌 신규 DB 연결 생성 (ID: ${connection.threadId})`);
});

// 에러 핸들링이 추가된 공통 객체
const db = {
    /**
     * SELECT 쿼리 실행 (목록 조회)
     * db.select: 데이터를 가져오는(Read) 용도
     * select<T> : 제네릭을 사용해 호출, T는 반환될 데이터의 타입을 지정
    */

    // db.select나 pool.execute의 제네릭에는
    // 반드시 RowDataPacket을 상속받은 타입을 넣어야 에러가 나지 않습니다.
    async select<T extends RowDataPacket>(sql: string, params?: any[]): Promise<T[]> {
        try {
            const [rows] = await pool.execute<T[]>(sql, params);
            return rows;
        } catch (error: any) {
            // console.error(`[DB Select Error] SQL: ${sql}`, error);
            // throw new DatabaseError(`조회 중 오류가 발생했습니다: ${error.message}`, error.code);

            // [개선] Winston 로거에 상세 쿼리 정보 기록
            logger.error(`[DB Select Error] ${error.message}`, {
                sql,
                params,
                dbCode: error.code, // 예: ER_ACCESS_DENIED_ERROR
                dbNo: error.errno
            });

            // 상세한 SQL 정보는 제외하고 사용자 친화적인 에러로 변환하여 던짐
            // DB 에러는 보안상 클라이언트에게 500 에러로 노출하며,
            // 내부적으로만 구체적인 DB 에러 코드(ER_DUP_ENTRY 등)를 관리합니다.
            throw new DatabaseError(`데이터 조회 중 오류가 발생했습니다.`, { code: error.code });
        }
    },

    /**
     * INSERT, UPDATE, DELETE 쿼리 실행
     * db.execute: 데이터를 변경(Write/Delete)하고 영향받은 행의 수 등을 확인하는 용도
     * 영향받은 행의 수나 삽입된 ID 등을 반환합니다.
    */

    async execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
        try {
            const [result] = await pool.execute<ResultSetHeader>(sql, params);
            return result;
        } catch (error: any) {
            // console.error(`[DB Execute Error] SQL: ${sql}`, error);
            // throw new DatabaseError(`실행 중 오류가 발생했습니다: ${error.message}`, error.code);
            logger.error(`[DB Execute Error] ${error.message}`, {
                sql,
                params,
                dbCode: error.code
            });
            
            throw new DatabaseError(`데이터 처리 중 오류가 발생했습니다.`, { code: error.code });
        }
    }
};

export default db;