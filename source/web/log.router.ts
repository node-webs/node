import { Router, Request, Response } from 'express';
import { verifyLogApiKey } from '../lib/middlewares/key';

const router = Router();

router.post('/log', verifyLogApiKey, async (req: Request, res: Response) => {
    try {
        // 1. Winston HTTP 트랜스포트가 보낸 데이터 추출
        // 수신 데이터 구조는 단일 객체이거나 대량 전송 시 배열 구조일 수 있으므로 이를 방어적으로 처리합니다.
        const body = req.body;
        
        if (!body) {
            return res.status(400).json({ success: false, message: 'No body provided' });
        }

        // 2. 응답을 클라이언트(송신 서버)에게 최대한 '즉시' 반환
        // 로그 저장 로직을 기다리느라 송신 측 Express가 블로킹(대기)되는 것을 막기 위해 응답부터 먼저 보냅니다.
        res.status(200).json({ success: true });

        // 3. 비동기 로그 처리 (배열 및 단일 객체 호환)
        const logEntries = Array.isArray(body) ? body : (body.logs ? body.logs : [body]);

        for (const log of logEntries) {
            // [주의] 수신 서버 콘솔에 찍을 때 또 logger를 쓰면 무한 루프가 발생하므로 여기서는 console.log를 씁니다.
            console.log(`📡 [원격 로그 수신] [${log.level || 'info'}] ${log.message || ''}`);

            // 4. 수신한 데이터를 가지고 할 작업 구현
            const { timestamp, level, message, request_id, ip, status_code, code, stack, error } = log;
            // 터미널 화면 기록 (이 독립 서버 내부에서는 터미널에 편하게 출력해도 안전함)
            console.log(`[${timestamp}] [${level.toUpperCase()}] [ID:${request_id || 'N/A'}] ${message}`);

            // 예시 A: 원격 DB나 또 다른 중앙 저장소에 적재하는 로직
            // await remoteDb.execute('INSERT INTO remote_logs ...', [...]);

            // 4. 레벨별 독립적 비즈니스 액션 추가
            if (level === 'error') {
                // 시스템 버그(500대 등) 발생 시 즉시 담당 개발자들에게 알림 발송
                // await sendSlackNotification(`🚨 [긴급] 서비스 버그 감지\nID: ${request_id}\n메시지: ${message}\n스택: ${stack}`);
            } else if (level === 'warn') {
                // 운영적 예외(400대 등)는 통계 집계용 데이터베이스나 파일에 기록
                // await logAnalyticsDb.execute('INSERT INTO ...');
            }
        }

    } catch (err) {
        // 이 엔드포인트 내부에서 에러가 나더라도 외부 송신 서버에 영향을 주지 않도록 차단
        console.error('CRITICAL: Failed to process received remote logs:', err);
        
        // 헤더가 이미 전송되지 않았다면 에러 응답 보냄
        if (!res.headersSent) {
            res.status(500).json({ success: false, error: 'Internal logging receiver error' });
        }
    }
});

export default router;
