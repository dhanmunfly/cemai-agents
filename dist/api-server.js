"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
const port = process.env.PORT ? Number(process.env.PORT) : 8080;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Request logging middleware
app.use((req, res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`, {
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent'),
        ip: req.ip
    });
    next();
});
// Health check endpoints
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'cemai-infrastructure-agents'
    });
});
app.get('/api/v1/ping', (_req, res) => {
    res.status(200).json({
        message: 'pong',
        timestamp: new Date().toISOString(),
        service: 'cemai-infrastructure-agents'
    });
});
app.get('/api/v1/version', (_req, res) => {
    res.status(200).json({
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.ENVIRONMENT || 'development'
    });
});
// Authentication endpoints (mock implementation)
app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body;
    // Mock authentication - replace with real implementation
    if (username === 'admin' && password === 'admin') {
        res.status(200).json({
            success: true,
            token: 'mock-jwt-token-' + Date.now(),
            user: {
                id: '1',
                username: 'admin',
                role: 'admin'
            }
        });
    }
    else {
        res.status(401).json({
            success: false,
            message: 'Invalid credentials'
        });
    }
});
app.post('/api/v1/auth/refresh', (req, res) => {
    res.status(200).json({
        success: true,
        token: 'mock-refreshed-token-' + Date.now()
    });
});
app.get('/api/v1/auth/me', (req, res) => {
    res.status(200).json({
        user: {
            id: '1',
            username: 'admin',
            role: 'admin'
        }
    });
});
// Agent status endpoints
app.get('/api/v1/agents/status', (_req, res) => {
    res.status(200).json({
        agents: [
            {
                id: 'guardian',
                name: 'Guardian Agent',
                status: 'healthy',
                url: 'https://guardian-agent-917156149361.asia-south1.run.app'
            },
            {
                id: 'optimizer',
                name: 'Optimizer Agent',
                status: 'healthy',
                url: 'https://optimizer-agent-917156149361.asia-south1.run.app'
            },
            {
                id: 'master-control',
                name: 'Master Control Agent',
                status: 'healthy',
                url: 'https://master-control-agent-917156149361.asia-south1.run.app'
            },
            {
                id: 'egress',
                name: 'Egress Agent',
                status: 'healthy',
                url: 'https://cemai-egress-agent-secure-917156149361.asia-south1.run.app'
            }
        ]
    });
});
// System metrics endpoint
app.get('/api/v1/metrics', (_req, res) => {
    res.status(200).json({
        timestamp: new Date().toISOString(),
        metrics: {
            cpu: Math.random() * 100,
            memory: Math.random() * 100,
            disk: Math.random() * 100,
            network: Math.random() * 100
        }
    });
});
// Error handling middleware
app.use((err, req, res, next) => {
    logger_1.logger.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});
// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
});
// Start server
app.listen(port, '0.0.0.0', () => {
    logger_1.logger.info(`CemAI Infrastructure API Server started on port ${port}`);
    logger_1.logger.info(`Environment: ${process.env.ENVIRONMENT || 'development'}`);
});
exports.default = app;
//# sourceMappingURL=api-server.js.map