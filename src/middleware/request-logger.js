import chalk from 'chalk';

/**
 * Request logger middleware using chalk.
 * Logs: method, URL, status code, response time, content-length, user-agent.
 */
export const requestLogger = (req, res, next) => {
    const start = Date.now();

    // Capture original end to intercept response
    const originalEnd = res.end;
    res.end = function (...args) {
        const duration = Date.now() - start;
        const status = res.statusCode;

        // Color-code method
        const methodColors = {
            GET: chalk.green.bold,
            POST: chalk.yellow.bold,
            PUT: chalk.blue.bold,
            DELETE: chalk.red.bold,
            PATCH: chalk.magenta.bold,
        };
        const colorMethod = (methodColors[req.method] || chalk.white.bold)(req.method.padEnd(7));

        // Color-code status
        let colorStatus;
        if (status >= 500) colorStatus = chalk.red.bold(status);
        else if (status >= 400) colorStatus = chalk.yellow.bold(status);
        else if (status >= 300) colorStatus = chalk.cyan(status);
        else colorStatus = chalk.green.bold(status);

        // Duration color
        let colorDuration;
        if (duration > 1000) colorDuration = chalk.red(`${duration}ms`);
        else if (duration > 200) colorDuration = chalk.yellow(`${duration}ms`);
        else colorDuration = chalk.green(`${duration}ms`);

        // Content length
        const contentLength = res.getHeader('content-length');
        const size = contentLength ? chalk.dim(`${contentLength}B`) : chalk.dim('-');

        // Query params
        const query = Object.keys(req.query || {}).length > 0
            ? chalk.dim(` ?${new URLSearchParams(req.query).toString()}`)
            : '';

        // Log line
        const timestamp = chalk.dim(new Date().toLocaleTimeString('vi-VN'));
        console.log(
            `${timestamp}  ${colorMethod}  ${chalk.white(req.originalUrl)}${query}  ${colorStatus}  ${colorDuration}  ${size}`
        );

        originalEnd.apply(res, args);
    };

    next();
};
