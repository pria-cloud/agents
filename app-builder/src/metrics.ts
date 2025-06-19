const counters: Record<string, number> = {
  intents_received: 0,
  llm_calls: 0,
  github_api_calls: 0,
  preview_api_calls: 0,
  errors: 0,
};

export function inc(counter: keyof typeof counters) {
  counters[counter]++;
}

export function get(counter: keyof typeof counters) {
  return counters[counter];
}

export function metricsAsPrometheus(): string {
  return Object.entries(counters)
    .map(([k, v]) => `# HELP pria_${k} Total ${k}\n# TYPE pria_${k} counter\npria_${k} ${v}`)
    .join('\n');
} 