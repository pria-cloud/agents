"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.A2AClient = void 0;
exports.registerAgent = registerAgent;
exports.sendIntent = sendIntent;
const axios_1 = __importDefault(require("axios"));
const A2A_ROUTER_URL = process.env.A2A_ROUTER_URL;
const A2A_API_KEY = process.env.A2A_API_KEY;
async function registerAgent(registration) {
    if (!A2A_ROUTER_URL)
        throw new Error('A2A_ROUTER_URL not set');
    try {
        const res = await axios_1.default.post(`${A2A_ROUTER_URL}/a2a/register`, registration, {
            headers: A2A_API_KEY ? { 'x-api-key': A2A_API_KEY } : {},
        });
        return res.data;
    }
    catch (err) {
        console.error('A2A registration error:', err?.response?.data || err.message);
        throw new Error('A2A registration failed');
    }
}
async function sendIntent(msg) {
    if (!A2A_ROUTER_URL)
        throw new Error('A2A_ROUTER_URL not set');
    try {
        const res = await axios_1.default.post(`${A2A_ROUTER_URL}/a2a/intent`, msg, {
            headers: A2A_API_KEY ? { 'x-api-key': A2A_API_KEY } : {},
        });
        return res.data;
    }
    catch (err) {
        console.error('A2A intent error:', err?.response?.data || err.message);
        throw new Error('A2A intent send failed');
    }
}
class A2AClient {
    constructor() {
        // Mock implementation
    }
    async registerAgent(registration) {
        return registerAgent(registration);
    }
    async sendIntent(msg) {
        return sendIntent(msg);
    }
}
exports.A2AClient = A2AClient;
//# sourceMappingURL=a2aClient.js.map