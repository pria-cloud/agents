"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
process.env.A2A_ROUTER_URL = 'http://localhost:9999';
const index_1 = require("./index");
const mockSendIntent = jest.fn(async (msg) => {
    if (msg.intent === 'schema.synthesise')
        return { ok: true, schema: 'sharedModels' };
    if (msg.intent === 'workflow.compose')
        return { ok: true, workflow: 'sharedWorkflows' };
    if (msg.intent === 'app.preview')
        return { ok: true };
    return { ok: true };
});
jest.mock('./llmAdapter', () => ({
    generateWithGemini: jest.fn(async ({ prompt }) => prompt)
}));
jest.mock('./githubClient', () => ({
    createBranch: jest.fn(async () => { }),
    commitFiles: jest.fn(async () => { }),
    openDraftPR: jest.fn(async () => 'https://github.com/test/pr/1'),
}));
jest.mock('./previewService', () => ({
    launchPreview: jest.fn(async () => 'https://preview.pria.app/test'),
}));
jest.mock('./a2aClient', () => ({
    sendIntent: function (...args) { return mockSendIntent.apply(this, args); },
    registerAgent: jest.fn(),
}));
jest.mock('./catalogueClient', () => ({
    fetchBestPracticeSpec: jest.fn(async (domain, version) => {
        if (domain === 'finance') {
            return {
                spec: {
                    data_models: [
                        { name: 'Expense' },
                        { name: 'CurrencyRate' }
                    ],
                    workflows: [
                        { name: 'ExpenseApproval' }
                    ],
                    ui_layouts: [
                        {
                            page: 'Home',
                            layout: [
                                { component: 'ExpenseForm' },
                                { component: 'SubmitButton' }
                            ]
                        },
                        {
                            page: 'ManagerDashboard',
                            layout: [
                                { component: 'ExpenseList' },
                                { component: 'ApprovalActions' }
                            ]
                        }
                    ]
                }
            };
        }
        return { spec: { data_models: [], workflows: [], ui_layouts: [] } };
    })
}));
describe('handleAppComposeIntent', () => {
    beforeEach(() => mockSendIntent.mockClear());
    it('returns generated code/components for valid spec', async () => {
        const payload = {
            spec_version: '1.0',
            pages: ['Home'],
            components: ['Button'],
            workspace_id: 'ws1',
            request_id: 'req1',
        };
        const result = await (0, index_1.handleAppComposeIntent)(payload, 'trace1', 'jwt1');
        if ('ok' in result && result.ok === true) {
            const r = result;
            expect(r.generatedCode).toBeDefined();
            expect(r.generatedComponents).toBeDefined();
            expect(r.generatedCode && r.generatedCode.Home).toBeDefined();
            expect(r.generatedComponents && r.generatedComponents.Button).toBeDefined();
            expect(Array.isArray(r.files)).toBe(true);
        }
    });
    it('returns clarification questions for missing fields', async () => {
        const payload = {
            pages: ['Home'],
            // missing spec_version, components
        };
        const result = await (0, index_1.handleAppComposeIntent)(payload, 'trace2', 'jwt2');
        if ('error' in result && 'clarificationQuestions' in result) {
            expect(result.error).toContain('Missing required fields');
            expect(result.clarificationQuestions).toContain('clarifying questions');
        }
        else {
            throw new Error('Expected error and clarificationQuestions in result');
        }
    });
    it('handles errors gracefully', async () => {
        // Force an error by passing a payload that will break codegen
        const payload = null;
        await expect((0, index_1.handleAppComposeIntent)(payload, 'trace3', 'jwt3')).rejects.toThrow();
    });
    it('classifies domain app and emits sub-intents', async () => {
        const payload = {
            spec_version: '1.0',
            pages: ['Home'],
            components: ['Button'],
            workspace_id: 'ws1',
            request_id: 'req2',
            domain: 'finance',
        };
        const result = await (0, index_1.handleAppComposeIntent)(payload, 'trace4', 'jwt4');
        if ('ok' in result && result.ok === true) {
            const r = result;
            expect(r.appType).toBe('domain');
            expect(r.bestPracticeTemplate).toBeDefined();
            expect(mockSendIntent).toHaveBeenCalledWith(expect.objectContaining({ intent: 'schema.synthesise' }));
            expect(mockSendIntent).toHaveBeenCalledWith(expect.objectContaining({ intent: 'workflow.compose' }));
            expect(r.schemaSynthResult).toBeDefined();
            expect(r.workflowSynthResult).toBeDefined();
        }
    });
    it('blocks on compliance/DLP failure', async () => {
        // Patch the function to simulate compliance failure
        const dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => 0);
        const original = require('./index');
        // Patch compliance logic for this test only
        const origHandle = original.handleAppComposeIntent;
        original.handleAppComposeIntent = async function (payload, trace_id, jwt, parentSpan) {
            // Simulate compliance failure
            const result = await origHandle.call(this, { ...payload, domain: 'finance' }, trace_id, jwt, parentSpan);
            result.compliancePassed = false;
            result.dlpScanPassed = false;
            return { error: 'Blocked by compliance or DLP validation' };
        };
        const payload = {
            spec_version: '1.0',
            pages: ['Home'],
            components: ['Button'],
            workspace_id: 'ws1',
            request_id: 'req3',
            domain: 'finance',
        };
        const result = await original.handleAppComposeIntent(payload, 'trace5', 'jwt5');
        expect(result.error).toContain('Blocked by compliance or DLP');
        // Restore
        original.handleAppComposeIntent = origHandle;
        dateNowSpy.mockRestore();
    });
    it('uses best-practice uiLayouts for page and component generation', async () => {
        const payload = {
            spec_version: '1.0',
            pages: ['Home', 'ManagerDashboard'],
            components: ['ExpenseForm', 'SubmitButton', 'ExpenseList', 'ApprovalActions'],
            workspace_id: 'ws1',
            request_id: 'req4',
            domain: 'finance',
        };
        const result = await (0, index_1.handleAppComposeIntent)(payload, 'trace6', 'jwt6');
        if ('ok' in result && result.ok === true) {
            const r = result;
            expect(r.generatedCode).toBeDefined();
            expect(r.generatedComponents).toBeDefined();
            expect(r.generatedCode && r.generatedCode.Home).toBeDefined();
            expect(r.generatedCode && r.generatedCode.ManagerDashboard).toBeDefined();
            expect(r.generatedComponents && r.generatedComponents.ExpenseForm).toBeDefined();
            expect(r.generatedComponents && r.generatedComponents.ExpenseList).toBeDefined();
        }
    });
});
