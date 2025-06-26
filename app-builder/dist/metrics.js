"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inc = inc;
exports.get = get;
exports.metricsAsPrometheus = metricsAsPrometheus;
const counters = {
    intents_received: 0,
    llm_calls: 0,
    github_api_calls: 0,
    preview_api_calls: 0,
    errors: 0,
};
function inc(counter) {
    counters[counter]++;
}
function get(counter) {
    return counters[counter];
}
function metricsAsPrometheus() {
    return Object.entries(counters)
        .map(([k, v]) => `# HELP pria_${k} Total ${k}\n# TYPE pria_${k} counter\npria_${k} ${v}`)
        .join('\n');
}
