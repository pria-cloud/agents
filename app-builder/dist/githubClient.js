"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBranch = createBranch;
exports.commitFiles = commitFiles;
exports.openDraftPR = openDraftPR;
const axios_1 = __importDefault(require("axios"));
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_API = 'https://api.github.com';
if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN not set');
}
const headers = {
    Authorization: `token ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
};
// Create a new branch from baseBranch
async function createBranch(repo, baseBranch, newBranch) {
    // Get the latest commit SHA of the base branch
    const refRes = await axios_1.default.get(`${GITHUB_API}/repos/${repo}/git/ref/heads/${baseBranch}`, { headers });
    const sha = refRes.data.object.sha;
    // Create the new branch
    await axios_1.default.post(`${GITHUB_API}/repos/${repo}/git/refs`, { ref: `refs/heads/${newBranch}`, sha }, { headers });
}
// Commit multiple files to a branch
async function commitFiles(repo, branch, files) {
    // Get the latest commit SHA and tree SHA
    const refRes = await axios_1.default.get(`${GITHUB_API}/repos/${repo}/git/ref/heads/${branch}`, { headers });
    const latestCommitSha = refRes.data.object.sha;
    const commitRes = await axios_1.default.get(`${GITHUB_API}/repos/${repo}/git/commits/${latestCommitSha}`, { headers });
    const baseTreeSha = commitRes.data.tree.sha;
    // Create blobs for each file
    const blobs = await Promise.all(files.map(async (file) => {
        let content = file.content;
        // If content is an object with 'parts', extract the text
        if (typeof content === 'object' && content !== null && Array.isArray(content.parts) && content.parts[0]?.text) {
            content = content.parts[0].text;
        }
        // If content is still not a string, stringify it
        if (typeof content !== 'string') {
            content = JSON.stringify(content, null, 2);
        }
        const blobRes = await axios_1.default.post(`${GITHUB_API}/repos/${repo}/git/blobs`, { content, encoding: 'utf-8' }, { headers });
        return { path: file.path, sha: blobRes.data.sha };
    }));
    // Create a new tree
    const treeRes = await axios_1.default.post(`${GITHUB_API}/repos/${repo}/git/trees`, {
        base_tree: baseTreeSha,
        tree: blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
    }, { headers });
    const newTreeSha = treeRes.data.sha;
    // Create a new commit
    const commitMsg = 'chore: add generated app code';
    const newCommitRes = await axios_1.default.post(`${GITHUB_API}/repos/${repo}/git/commits`, {
        message: commitMsg,
        tree: newTreeSha,
        parents: [latestCommitSha],
    }, { headers });
    const newCommitSha = newCommitRes.data.sha;
    // Update the branch ref
    await axios_1.default.patch(`${GITHUB_API}/repos/${repo}/git/refs/heads/${branch}`, { sha: newCommitSha }, { headers });
}
// Open a draft pull request
async function openDraftPR(repo, branch, title, body) {
    const prRes = await axios_1.default.post(`${GITHUB_API}/repos/${repo}/pulls`, {
        title,
        head: branch,
        base: 'main',
        body,
        draft: true,
    }, { headers });
    return prRes.data.html_url;
}
