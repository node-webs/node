import { Request, Response } from 'express';

const page = {
    index: (req: Request, res: Response) => {
        res.render('index');
    },
    page: (req: Request, res: Response) => {
        const pageName = decodeURIComponent(req.params.path as string);
        // as string은 TypeScript에게 pageName이 문자열임을 명시적으로 알려주는 구문입니다. req.params.path는 URL 경로에서 추출된 값이므로, 일반적으로 문자열이지만, TypeScript는 이를 명확하게 알 수 없기 때문에 타입 단언을 사용하여 문자열로 간주하도록 합니다.
        res.send(`요청된 페이지: ${pageName}`);
    }
};

export { page };