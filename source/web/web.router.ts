import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
    res.render('index', { title: 'My Nunjucks Page' });
});

export default router;