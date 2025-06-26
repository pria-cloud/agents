"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordInferenceCost = recordInferenceCost;
exports.recordIntentLatency = recordIntentLatency;
exports.recordError = recordError;
const api_1 = require("@opentelemetry/api");
const meter = api_1.metrics.getMeter('app-builder');
const inferenceCostCounter = meter.createCounter('agent_inference_cost_usd', {
    description: 'Total LLM inference cost in USD',
});
const intentLatencyHist = meter.createHistogram('agent_intent_latency_ms', {
    description: 'Intent handling latency in milliseconds',
});
const errorCounter = meter.createCounter('agent_error_total', {
    description: 'Total errors encountered by the agent',
});
function recordInferenceCost(cost, labels) {
    inferenceCostCounter.add(cost, labels);
}
function recordIntentLatency(ms, labels) {
    intentLatencyHist.record(ms, labels);
}
function recordError(labels) {
    errorCounter.add(1, labels);
}
// TODO: Add more metrics as needed (e.g., GitHub API calls, preview API calls) 
