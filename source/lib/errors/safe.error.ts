
import { Request, Response, NextFunction, RequestHandler } from 'express';

// Express 4는 async 함수 내에서 throw가 발생하거나 Promise가 reject될 때 next(err)를 자동으로 호출해주지 않는데, 이 래퍼가 그 역할을 완벽히 대신하고 있습니다.
// 지금 만든 NotFoundError, ValidationError 등을 그냥 throw만 해도 방금 작성하신 errorHandler 미들웨어로 자동 전달됩

export const safeWrapper = (fn: RequestHandler): RequestHandler => {
    return (req, res, next) => {
        // fn의 결과가 동기면 바로 실행, 비동기면 Promise를 반환함.
        // Promise.resolve().catch(next) 패턴은 동기/비동기 에러를 모두 next로 넘겨줍니다.
        Promise.resolve(fn(req, res, next)).catch(next);
    };
    // res.send 이후의 에러 :
    // 컨트롤러 내부에서 응답(res.json 등)을 이미 보낸 뒤에 throw가 발생하면,
    // safeWrapper가 이를 잡아 next(err)로 넘기더라도 Express는 "이미 헤더가 전송되었다"는
    // 에러를 뱉을 수 있습니다. (이는 모든 래퍼의 공통 사항입니다.)

    // 상속된 에러 클래스와의 조합:
    // 작성하신 WebError 상속 클래스들을 이 safeWrapper 안에서 throw 하면,
    // 아까 만드신 errorHandler에서 아주 예쁘게 로그가 찍히고 응답이 나갈 것입니다.
};

// 적용 전
// app.get('/user', async (req, res, next) => {
//     try {
//         const user = await userService.get(req.user.id);
//         res.json(user);
//     } catch (err) {
//         next(err);
//     }
// });

// 적용 후
// app.get('/user', safeWrapper(async (req, res) => {
//     const user = await userService.get(req.user.id); // 에러 나면 알아서 errorHandler로!
//     res.json(user);
// }));

export const safeWrapper2 = (
    // 동기 함수와 비동기 함수를 모두 처리할 수 있는 범용 에러 처리기
    fn: (req: Request, res: Response, next: NextFunction) => any
): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction) => {
        // try...catch로 함수를 감싸서 실행
        // 여기서 동기적 에러를 즉시 잡아냅니다
        try {
            const result = fn(req, res, next);
            if (result instanceof Promise) {
                // 만약 함수의 실행 결과(result)가 Promise 객체라면,
                // 비동기 처리가 필요하므로 .catch(next)를 연결해 비동기 에러를 처리
                result.catch(next);
            }
        } catch (error) {
            // 어떤 상황에서든 에러가 발생하면 next(error)를 호출해
            // 다음 미들웨어(에러 핸들러)로 전달
            next(error);

            // 보통 try-catch문에서 에러가 발생하면
            // catch문에서 next(error)로 전달해야 하며
            // 전달하지 않으면, 서버가 멈추거나 응답을 보내지 못한 채 타임아웃이 발생

            // 그러나 safeWrapper에서 에러를 잡아서 next로 넘겨주는 로직을 대신 수행하므로
            // try-catch 문을 사용 안해서 된다.

            // app.get('/user', safeWrapper(async (req, res) => {
            //     const user = await userService.get(req.params.id);
            //     res.json(user);
            // }));
        }
    };
};
