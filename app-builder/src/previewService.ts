import axios from 'axios';

export interface ProjectFile {
  path: string;
  content: string;
}

// Launch a live preview for the generated app
export async function launchPreview(files: ProjectFile[]): Promise<string> {
  // Option 1: Remote preview API integration (recommended for production)
  // Replace with your actual preview service endpoint
  const PREVIEW_API_URL = process.env.PREVIEW_API_URL || 'https://preview.pria.app/api/launch';
  try {
    // POST the files as JSON to the preview API
    const res = await axios.post(PREVIEW_API_URL, { files });
    if (res.data && res.data.previewUrl) {
      return res.data.previewUrl;
    }
  } catch (err) {
    console.error('Remote preview API failed:', err);
  }

  // Option 2: WebContainer SDK (StackBlitz) integration
  // TODO: Integrate with WebContainer SDK here if running in a browser or Node.js with support
  // Example:
  // const webcontainer = await WebContainer.boot();
  // await webcontainer.mount(filesAsFsTree);
  // const url = await webcontainer.previewUrl();
  // return url;

  // Fallback: return a placeholder
  return 'https://preview.pria.app/workspace/app/session';
} 