import { Router, Request, Response } from 'express';
// 데이터베이스 풀 임포트 (예시 명칭, 프로젝트 환경에 맞게 수정한 mysql-2 사용)
import db from './mysql-2'; 

const router = Router();

// 📊 대시보드 메인 데이터 요청 (최근 로그 요약 및 통계)
router.get('/api/v1/dashboard/summary', async (req: Request, res: Response) => {
    try {
        // [통계 1] 최근 24시간 동안의 레벨별 로그 발생 건수 조회
        const [levelStats]: any = await db.execute(`
            SELECT level, COUNT(*) as count 
            FROM app_logs 
            WHERE timestamp >= NOW() - INTERVAL 1 DAY 
            GROUP BY level
        `);

        // [통계 2] 최근 24시간 동안의 API 성공 / 실패율 조회
        const [successStats]: any = await db.execute(`
            SELECT success, COUNT(*) as count 
            FROM app_logs 
            WHERE timestamp >= NOW() - INTERVAL 1 DAY 
            GROUP BY success
        `);

        // [목록 3] 최근 발생한 심각한 에러 로그 최신 10건 목록 조회
        const [recentErrors]: any = await db.execute(`
            SELECT id, timestamp, level, message, request_id, ip, status_code, code 
            FROM app_logs 
            WHERE level = 'error' 
            ORDER BY timestamp DESC 
            LIMIT 10
        `);

        // 프론트엔드 화면 구성을 위한 커스텀 데이터 포맷 조립
        res.status(200).json({
            success: true,
            data: {
                summary24h: {
                    statsByLevel: levelStats,
                    statsBySuccess: successStats
                },
                recentErrors: recentErrors
            }
        });
    } catch (err) {
        console.error('Failed to fetch dashboard summary:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;
