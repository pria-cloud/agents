"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startOtel = startOtel;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_prometheus_1 = require("@opentelemetry/exporter-prometheus");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
// NOTE: For OTEL v1.0+, PrometheusExporter is passed directly as metricReader
const serviceName = 'app-builder';
const serviceVersion = '1.0.0';
const environment = process.env.NODE_ENV || 'development';
const prometheusPort = 9464;
const prometheusEndpoint = '/metrics';
// Resource config removed for compatibility; restore after package alignment
// const { Resource } = require('@opentelemetry/resources');
// const otelResource = new Resource({ ... });
const prometheusExporter = new exporter_prometheus_1.PrometheusExporter({
    port: prometheusPort,
    endpoint: prometheusEndpoint,
});
const sdk = new sdk_node_1.NodeSDK({
    // resource: otelResource,
    traceExporter: new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: prometheusExporter,
    instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
});
async function startOtel() {
    await sdk.start();
    console.log(`OTEL metrics available at http://localhost:${prometheusPort}${prometheusEndpoint}`);
}
// TODO: Add Loki log exporter for structured logs
// TODO: Add custom attributes (workspace_id, request_id, etc.) to spans and metrics 
