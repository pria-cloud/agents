import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('app-builder');

const inferenceCostCounter = meter.createCounter('agent_inference_cost_usd', {
  description: 'Total LLM inference cost in USD',
});

const intentLatencyHist = meter.createHistogram('agent_intent_latency_ms', {
  description: 'Intent handling latency in milliseconds',
});

const errorCounter = meter.createCounter('agent_error_total', {
  description: 'Total errors encountered by the agent',
});

export function recordInferenceCost(cost: number, labels: Record<string, string>) {
  inferenceCostCounter.add(cost, labels);
}

export function recordIntentLatency(ms: number, labels: Record<string, string>) {
  intentLatencyHist.record(ms, labels);
}

export function recordError(labels: Record<string, string>) {
  errorCounter.add(1, labels);
}

// TODO: Add more metrics as needed (e.g., GitHub API calls, preview API calls) 