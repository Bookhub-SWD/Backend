import swaggerJsdoc from 'swagger-jsdoc';

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
        url: 'http://localhost:3001/api',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/docs/*.yaml', './src/docs/paths/*.yaml'], // Files containing annotations
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
