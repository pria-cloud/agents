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

export interface IntentMessage {
  intent: string;
  trace_id?: string;
  jwt?: string;
  [key: string]: any;
}

export async function registerAgent(registration: AgentRegistration) {
  if (!A2A_ROUTER_URL) throw new Error('A2A_ROUTER_URL not set');
  
  try {
    const res = await axios.post(`${A2A_ROUTER_URL}/a2a/register`, registration, {
      headers: A2A_API_KEY ? { 'x-api-key': A2A_API_KEY } : {},
    });
    return res.data;
  } catch (err: any) {
    console.error('A2A registration error:', err?.response?.data || err.message);
    throw new Error('A2A registration failed');
  }
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

export class A2AClient {
  constructor() {
    // Mock implementation
  }
  
  async registerAgent(registration: AgentRegistration) {
    return registerAgent(registration);
  }
  
  async sendIntent(msg: IntentMessage) {
    return sendIntent(msg);
  }
} 