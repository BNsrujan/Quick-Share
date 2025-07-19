"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Global test setup
const database_1 = require("../database");
// Increase timeout for all tests
jest.setTimeout(10000);
// Mock console methods to reduce noise in test output
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
};
// Clean up after all tests
afterAll(async () => {
    await (0, database_1.closeDatabase)();
});
