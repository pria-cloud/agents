"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchBestPracticeSpec = fetchBestPracticeSpec;
const axios_1 = __importDefault(require("axios"));
const js_yaml_1 = __importDefault(require("js-yaml"));
const api_1 = require("@opentelemetry/api");
const GITHUB_TOKEN = process.env.CATALOGUE_GITHUB_TOKEN;
const REPO_OWNER = 'pria-cloud';
const REPO_NAME = 'best-practice-catalogue';
const DEFAULT_BRANCH = 'main';
async function fetchBestPracticeSpec(domain, version = '1.0.0') {
    const tracer = api_1.trace.getTracer('app-builder');
    return await tracer.startActiveSpan('catalogue.fetch', async (span) => {
        try {
            const path = `${domain}/${version}.yaml`;
            const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${DEFAULT_BRANCH}`;
            const headers = {
                Accept: 'application/vnd.github.v3.raw',
            };
            if (GITHUB_TOKEN)
                headers['Authorization'] = `token ${GITHUB_TOKEN}`;
            const res = await axios_1.default.get(url, { headers });
            const spec = js_yaml_1.default.load(res.data);
            span.setAttribute('catalogue.domain', domain);
            span.setAttribute('catalogue.version', version);
            span.setStatus({ code: 1 });
            span.end();
            return spec;
        }
        catch (err) {
            span.recordException(err);
            span.setStatus({ code: 2, message: String(err) });
            span.end();
            throw new Error(`Failed to fetch best-practice spec for ${domain}@${version}: ${err}`);
        }
    });
}
