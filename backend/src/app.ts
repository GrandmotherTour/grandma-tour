import express from 'express';
import cors from 'cors';
import healthRoutes from './routes/health.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import placesRoutes from './routes/places.routes.js';
import locationRoutes from './routes/location.routes.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.use('/api/health', healthRoutes);
app.use('/api/recommendation', recommendationRoutes);
app.use('/api/places', placesRoutes);
app.use('/api/location', locationRoutes);

app.use(errorHandler);

export default app;
