"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAgent = registerAgent;
exports.sendIntent = sendIntent;
const axios_1 = __importDefault(require("axios"));
const A2A_ROUTER_URL = process.env.A2A_ROUTER_URL;
async function registerAgent(reg) {
    if (!A2A_ROUTER_URL)
        throw new Error('A2A_ROUTER_URL not set');
    try {
        const res = await axios_1.default.post(`${A2A_ROUTER_URL}/agents/register`, reg);
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
        const res = await axios_1.default.post(`${A2A_ROUTER_URL}/a2a/intent`, msg);
        return res.data;
    }
    catch (err) {
        console.error('A2A intent error:', err?.response?.data || err.message);
        throw new Error('A2A intent send failed');
    }
}
