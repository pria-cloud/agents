import axios from 'axios';

const A2A_ROUTER_URL = process.env.A2A_ROUTER_URL;
const A2A_API_KEY = process.env.A2A_API_KEY;

export interface AgentRegistration {
  agent_name: string;
  version: string;
  capabilities: string[];
  endpoint_url: string;
  supports_mcp: boolean;
}

export async function registerAgent(reg: AgentRegistration) {
  if (!A2A_ROUTER_URL) throw new Error('A2A_ROUTER_URL not set');
  try {
    const res = await axios.post(`${A2A_ROUTER_URL}/agents/register`, reg, {
      headers: A2A_API_KEY ? { 'x-api-key': A2A_API_KEY } : {},
    });
    return res.data;
  } catch (err: any) {
    console.error('A2A registration error:', err?.response?.data || err.message);
    throw new Error('A2A registration failed');
  }
}

export interface IntentMessage {
  intent: string;
  payload: any;
  trace_id: string;
  handoff_count?: number;
  jwt: string;
}

export async function sendIntent(msg: IntentMessage) {
  if (!A2A_ROUTER_URL) throw new Error('A2A_ROUTER_URL not set');
  try {
    const res = await axios.post(`${A2A_ROUTER_URL}/a2a/intent`, msg, {
      headers: A2A_API_KEY ? { 'x-api-key': A2A_API_KEY } : {},
    });
    return res.data;
  } catch (err: any) {
    console.error('A2A intent error:', err?.response?.data || err.message);
    throw new Error('A2A intent send failed');
  }
} 