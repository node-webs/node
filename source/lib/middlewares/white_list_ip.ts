import { Request, Response, NextFunction } from 'express';

// app.use('/api/v1/dashboard', ipWhitelistMiddleware, dashboardRouter);

// 허용할 개발자 및 사무실 IP 목록 (환경 변수 또는 배열로 관리)
const ALLOWED_IPS = process.env.ALLOWED_DEV_IPS 
    ? process.env.ALLOWED_DEV_IPS.split(',') 
    : ['127.0.0.1', '::1', '192.168.0.10']; // 예시 IP (IPv4 및 IPv6 로컬 주소 포함)

export const ipWhitelistMiddleware = (req: Request, res: Response, next: NextFunction) => {
    // 프록시 서버(Nginx, AWS ALB 등)가 앞에 있을 때 실제 클라이언트 IP 추출
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
    
    // x-forwarded-for의 경우 여러 IP가 콤마로 연결되어 올 수 있으므로 첫 번째 IP만 추출
    const cleanIp = clientIp.split(',')[0].trim();

    if (!ALLOWED_IPS.includes(cleanIp)) {
        console.warn(`🚨 [접근 차단] 미인증 IP 접근 시도: ${cleanIp}`);
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied: Your IP is not authorized.' 
        });
    }

    next();
};
