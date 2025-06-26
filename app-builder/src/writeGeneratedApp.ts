import * as fs from 'fs';
import * as path from 'path';
import { marked } from 'marked';

// Example usage: node dist/writeGeneratedApp.js <path-to-agent-response.json>

function ensureDirSync(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFileSyncSafe(filePath: string, content: string) {
  ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

// Helper: Extract first code block from a string (any language tag)
function extractFirstCodeBlockStrict(section: string): string | null {
  // Match the first code block (```lang\n...\n```), allowing for extra whitespace
  const match = section.match(/```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```/);
  return match ? match[1].trim() : null;
}

// Helper: Parse <pria-write filename=...>...</pria-write> blocks, robust to common LLM typos in closing tag
// Accepts </pria-write>, </pia-write>, </priawrite>, etc.
export function parsePriaWriteBlocks(output: string): { filePath: string; content: string }[] {
  // Regex matches <pria-write filename=...>...</pria-write> and common typo variants
  const blockRegex = /<pria-write filename=([^>]+)>([\s\S]*?)(<\/pria-write>|<\/pia-write>|<\/priawrite>)/g;
  const files: { filePath: string; content: string }[] = [];
  let match;
  while ((match = blockRegex.exec(output)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    if (filePath && content) {
      files.push({ filePath, content });
    } else {
      console.warn(`[writeGeneratedApp] Malformed <pria-write> block for file: ${filePath}`);
    }
  }
  return files;
}

// Helper: Parse <pria-dependency>...</pria-dependency> tags
export function parsePriaDependencyTags(output: string): string[] {
  const depRegex = /<pria-dependency>([\s\S]*?)<\/pria-dependency>/g;
  const dependencies: string[] = [];
  let match;
  while ((match = depRegex.exec(output)) !== null) {
    const dependency = match[1].trim();
    if (dependency) {
      dependencies.push(dependency);
    }
  }
  return dependencies;
}

function main() {
  const [, , responsePath] = process.argv;
  if (!responsePath) {
    console.error('Usage: node dist/writeGeneratedApp.js <path-to-agent-response.json>');
    process.exit(1);
  }
  const response = JSON.parse(fs.readFileSync(responsePath, 'utf8'));
  const outDir = path.resolve(__dirname, '../generated-app');

  // If markdown output is present (from new codegen), parse and write files
  if (typeof response.generatedCode === 'string') {
    const files = parsePriaWriteBlocks(response.generatedCode);
    if (files.length === 0) {
      // Fallback: try to extract a single code block and write to Home.tsx
      const code = extractFirstCodeBlockStrict(response.generatedCode);
      if (code) {
        writeFileSyncSafe(path.join(outDir, 'pages', 'Home.tsx'), code);
      } else {
        console.warn('No code block found in generatedCode. Nothing written.');
      }
    } else {
      files.forEach(({ filePath, content }) => {
        writeFileSyncSafe(path.join(outDir, filePath), content);
      });
    }
  } else {
    // Legacy: Write pages
    const generatedCode = response.generatedCode || {};
    Object.entries(generatedCode).forEach(([pageName, codeObj]) => {
      let code = codeObj;
      if (codeObj && typeof codeObj === 'object' && 'parts' in codeObj && Array.isArray((codeObj as any).parts) && (codeObj as any).parts[0]?.text) {
        code = (codeObj as any).parts[0].text;
      }
      // Always extract code block if present
      const codeBlock = extractFirstCodeBlockStrict(String(code));
      if (codeBlock) {
        writeFileSyncSafe(path.join(outDir, 'pages', `${pageName}.tsx`), codeBlock);
      } else {
        console.warn(`No code block found for page: ${pageName}, writing raw string.`);
        writeFileSyncSafe(path.join(outDir, 'pages', `${pageName}.tsx`), String(code));
      }
    });
  }

  // If markdown output is present for components, parse and write files
  if (typeof response.generatedComponents === 'string') {
    const files = parsePriaWriteBlocks(response.generatedComponents);
    if (files.length === 0) {
      // Fallback: try to extract a single code block and write to Header.tsx
      const code = extractFirstCodeBlockStrict(response.generatedComponents);
      if (code) {
        writeFileSyncSafe(path.join(outDir, 'components', 'Header.tsx'), code);
      } else {
        console.warn('No code block found in generatedComponents. Nothing written.');
      }
    } else {
      files.forEach(({ filePath, content }) => {
        writeFileSyncSafe(path.join(outDir, filePath), content);
      });
    }
  } else {
    // Legacy: Write components
    const generatedComponents = response.generatedComponents || {};
    Object.entries(generatedComponents).forEach(([compName, codeObj]) => {
      let code = codeObj;
      if (codeObj && typeof codeObj === 'object' && 'parts' in codeObj && Array.isArray((codeObj as any).parts) && (codeObj as any).parts[0]?.text) {
        code = (codeObj as any).parts[0].text;
      }
      // Always extract code block if present
      const codeBlock = extractFirstCodeBlockStrict(String(code));
      if (codeBlock) {
        writeFileSyncSafe(path.join(outDir, 'components', `${compName}.tsx`), codeBlock);
      } else {
        console.warn(`No code block found for component: ${compName}, writing raw string.`);
        writeFileSyncSafe(path.join(outDir, 'components', `${compName}.tsx`), String(code));
      }
    });
  }

  // Write minimal package.json
  const pkgJson = {
    name: 'generated-app',
    private: true,
    scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
    dependencies: {
      next: '^14.2.3',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'tailwindcss': '^3.4.1',
      '@types/react': '^18.2.0',
      '@types/node': '^20.0.0',
      typescript: '^5.0.0'
    }
  };
  writeFileSyncSafe(path.join(outDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

  // Write minimal tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
      jsx: 'preserve',
      moduleResolution: 'node',
      resolveJsonModule: true,
      isolatedModules: true,
      esModuleInterop: true,
      strict: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
    exclude: ['node_modules']
  };
  writeFileSyncSafe(path.join(outDir, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));

  console.log('Generated app written to', outDir);
}

if (require.main === module) {
  main();
} 