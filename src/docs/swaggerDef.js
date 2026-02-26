import swaggerJsdoc from 'swagger-jsdoc';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BookHub API',
      version: '1.0.0',
      description: 'API documentation for BookHub Backend',
    },
    servers: [
      {
        url: `http://localhost:${PORT}/api`,
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/docs/*.yaml', './src/docs/paths/*.yaml'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
