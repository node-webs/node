import express, { Express } from 'express';

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(PORT, () => {
  console.log(`Analyze Server is running on http://localhost:${PORT}`);
});