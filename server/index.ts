import express from 'express';
import cors from 'cors';
import { dialogueRouter } from './routes/dialogue';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', dialogueRouter);

const PORT = process.env.PORT || 3001;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Backend server listening on port ${PORT}`);
  });
}

export default app;
