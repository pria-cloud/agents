import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
// NOTE: For OTEL v1.0+, PrometheusExporter is passed directly as metricReader
const serviceName = 'app-builder';
const serviceVersion = '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const prometheusPort = 9464;
const prometheusEndpoint = '/metrics';
// Resource config removed for compatibility; restore after package alignment
// const { Resource } = require('@opentelemetry/resources');
// const otelResource = new Resource({ ... });
const prometheusExporter = new PrometheusExporter({
    port: prometheusPort,
    endpoint: prometheusEndpoint,
});
const sdk = new NodeSDK({
    // resource: otelResource,
    traceExporter: new OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: prometheusExporter,
    instrumentations: [getNodeAutoInstrumentations()],
});
export async function startOtel() {
    await sdk.start();
    console.log(`OTEL metrics available at http://localhost:${prometheusPort}${prometheusEndpoint}`);
}
// TODO: Add Loki log exporter for structured logs
// TODO: Add custom attributes (workspace_id, request_id, etc.) to spans and metrics 
