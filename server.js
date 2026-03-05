import dotenv from 'dotenv';
dotenv.config();
import chalk from 'chalk';
import app from './src/app.js';

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log(chalk.bold.green('🚀 Server is running!'));
  console.log(chalk.dim('─────────────────────────────────────────'));
  console.log(`  ${chalk.bold('PORT')}     ${chalk.cyan(PORT)}`);
  console.log('');
  console.log(chalk.bold.white('  📌 Endpoints:'));
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/health`)}`);
  console.log(`  ${chalk.yellow('POST')}   ${chalk.white(`${BASE_URL}/api/auth/google`)}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/auth/me`)}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/books`)}  ${chalk.dim('?title=&subject_code=&category=')}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/books/search`)}  ${chalk.dim('?q=<keyword>')}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/books/:id`)}`);
  console.log(`  ${chalk.yellow('POST')}   ${chalk.white(`${BASE_URL}/api/books`)}`);
  console.log(`  ${chalk.blue('PUT')}    ${chalk.white(`${BASE_URL}/api/books/:id`)}`);
  console.log(`  ${chalk.red('DELETE')} ${chalk.white(`${BASE_URL}/api/books/:id`)}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/subjects`)}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/subjects/categories`)}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/events`)}  ${chalk.dim('?status=&search=')}`);
  console.log(`  ${chalk.green('GET')}    ${chalk.white(`${BASE_URL}/api/events/:id`)}`);
  console.log(`  ${chalk.yellow('POST')}   ${chalk.white(`${BASE_URL}/api/events`)}`);
  console.log(`  ${chalk.blue('PUT')}    ${chalk.white(`${BASE_URL}/api/events/:id`)}`);
  console.log(`  ${chalk.red('DELETE')} ${chalk.white(`${BASE_URL}/api/events/:id`)}`);
  console.log(`  ${chalk.yellow('POST')}   ${chalk.white(`${BASE_URL}/api/events/:id/register`)}`);
  console.log(`  ${chalk.red('DELETE')} ${chalk.white(`${BASE_URL}/api/events/:id/register`)}`);
  console.log('');
  console.log(`  ${chalk.bold('📖 API Docs:')} ${chalk.cyan.underline(`${BASE_URL}/api-docs`)}`);
  console.log(chalk.dim('─────────────────────────────────────────'));
  console.log('');
});
