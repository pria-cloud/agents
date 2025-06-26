import axios from 'axios';
const A2A_ROUTER_URL = process.env.A2A_ROUTER_URL;
export async function registerAgent(reg) {
    if (!A2A_ROUTER_URL)
        throw new Error('A2A_ROUTER_URL not set');
    try {
        const res = await axios.post(`${A2A_ROUTER_URL}/agents/register`, reg);
        return res.data;
    }
    catch (err) {
        console.error('A2A registration error:', err?.response?.data || err.message);
        throw new Error('A2A registration failed');
    }
}
export async function sendIntent(msg) {
    if (!A2A_ROUTER_URL)
        throw new Error('A2A_ROUTER_URL not set');
    try {
        const res = await axios.post(`${A2A_ROUTER_URL}/a2a/intent`, msg);
        return res.data;
    }
    catch (err) {
        console.error('A2A intent error:', err?.response?.data || err.message);
        throw new Error('A2A intent send failed');
    }
}
