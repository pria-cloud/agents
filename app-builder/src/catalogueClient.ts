import axios from 'axios';
import yaml from 'js-yaml';
import { trace } from '@opentelemetry/api';

const GITHUB_TOKEN = process.env.CATALOGUE_GITHUB_TOKEN;
const REPO_OWNER = 'pria-cloud';
const REPO_NAME = 'best-practice-catalogue';
const DEFAULT_BRANCH = 'main';

export async function fetchBestPracticeSpec(domain: string, version: string = '1.0.0') {
  const tracer = trace.getTracer('app-builder');
  return await tracer.startActiveSpan('catalogue.fetch', async (span) => {
    try {
      const path = `${domain}/${version}.yaml`;
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}?ref=${DEFAULT_BRANCH}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3.raw',
      };
      if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
      const res = await axios.get(url, { headers });
      const spec = yaml.load(res.data);
      span.setAttribute('catalogue.domain', domain);
      span.setAttribute('catalogue.version', version);
      span.setStatus({ code: 1 });
      span.end();
      return spec;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: 2, message: String(err) });
      span.end();
      throw new Error(`Failed to fetch best-practice spec for ${domain}@${version}: ${err}`);
    }
  });
} 