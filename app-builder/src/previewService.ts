import axios from 'axios';

export interface ProjectFile {
  path: string;
  content: string;
}

// Launch a live preview for the generated app
export async function launchPreview(files: any[]) {
  // Stub: just return a local placeholder URL
  return 'http://localhost:5000/preview-not-implemented';
} 