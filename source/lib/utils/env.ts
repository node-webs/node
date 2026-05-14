import path from 'path';
import dotenv from 'dotenv';

const envMode = process.env.NODE_ENV || 'web';
const envPath = path.join(process.cwd(), 'html', 'a_data', `.env.${envMode}`);
// process.cwd()는 프로젝트의 루트 폴더(일반적으로 package.json이 있는 곳)

const envResult = dotenv.config({ path: envPath });
if (envResult.error) {
    console.error("환경 변수 로드 실패! 경로를 확인하세요:", envPath);
    console.error("에러 내용:", envResult.error);
}