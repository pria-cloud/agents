const counters = {
    intents_received: 0,
    llm_calls: 0,
    github_api_calls: 0,
    preview_api_calls: 0,
    errors: 0,
};
export function inc(counter) {
    counters[counter]++;
}
export function get(counter) {
    return counters[counter];
}
export function metricsAsPrometheus() {
    return Object.entries(counters)
        .map(([k, v]) => `# HELP pria_${k} Total ${k}\n# TYPE pria_${k} counter\npria_${k} ${v}`)
        .join('\n');
}
