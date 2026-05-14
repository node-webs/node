import { Request, Response, NextFunction } from 'express';

export const verifyLogApiKey = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-log-api-key'];
    const expectedKey = process.env.LOG_SERVER_API_KEY || 'my-secure-secret-key';

    if (!apiKey || apiKey !== expectedKey) {
        // 인증 실패 시 403 차단
        return res.status(403).json({ success: false, message: 'Unauthorized logging request' });
    }
    next();
};