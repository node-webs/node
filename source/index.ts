import express, { Express } from 'express';

// [ import ]
import logRouter from './web/log.router';

const app: Express = express();
const PORT = process.env.PORT || 3000;


// 로그 수신 라우터 연결
app.use(logRouter);

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(PORT, () => {
  console.log(`Analyze Server is running on http://localhost:${PORT}`);
});