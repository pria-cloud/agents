# PRIA Best Practices Catalogue Specification

## 1. Purpose & Scope

The Best Practices Catalogue provides a structured, versioned repository of best practice specifications for common business domains. Each entry includes:
- **Processes** (business flows, compliance steps)
- **Workflows** (automation, approval chains)
- **Data Models** (entities, relationships, constraints)
- **Integrations** (external SaaS, APIs, event sources)
- **UI Layouts** (recommended page/component structures)

All specifications are stored in human-readable formats (JSON or YAML) to enable:
- Automated consumption by PRIA agents (App-Builder, Schema-Composer, etc.)
- Easy review and extension by domain experts
- Traceable, auditable evolution of best practices

## 2. Catalogue Structure

- **Domain**: e.g., `finance`, `hr`, `crm`, `ecommerce`
- **Version**: Semantic versioning (e.g., `1.0.0`)
- **Spec**:
  - `processes`: List of named business processes with descriptions
  - `workflows`: List of workflow templates (in JSON/YAML, referencing Workflow DSL)
  - `data_models`: List of entities, attributes, and relationships (JSON/YAML)
  - `integrations`: List of recommended or supported integrations (name, type, API details)
  - `ui_layouts`: Page/component layout templates (JSON/YAML, e.g., for Next.js)

## 3. Example Entry (YAML)

```yaml
domain: finance
version: 1.0.0
spec:
  processes:
    - name: Expense Approval
      description: >
        Employees submit expenses, which are reviewed and approved by managers. Includes policy checks and audit trail.
    - name: Budget Planning
      description: >
        Annual and quarterly budget planning with multi-level review and sign-off.
  workflows:
    - name: ExpenseApprovalWorkflow
      dsl:
        version: 1
        steps:
          - id: submit_expense
            type: form
            actor: employee
          - id: manager_review
            type: approval
            actor: manager
          - id: audit_log
            type: log
            actor: system
  data_models:
    - name: Expense
      attributes:
        - name: id
          type: uuid
        - name: amount
          type: decimal
        - name: currency
          type: string
        - name: submitted_by
          type: user_id
        - name: status
          type: enum
          values: [pending, approved, rejected]
    - name: Budget
      attributes:
        - name: id
          type: uuid
        - name: department
          type: string
        - name: amount
          type: decimal
        - name: period
          type: string
  integrations:
    - name: Slack
      type: notification
      api: slack.com/api
    - name: SAP
      type: erp
      api: sap.com/api
  ui_layouts:
    - page: ExpenseSubmission
      layout:
        - component: ExpenseForm
        - component: SubmitButton
    - page: ManagerDashboard
      layout:
        - component: ExpenseList
        - component: ApprovalActions
```

## 4. API & Consumption

- Catalogue entries are retrievable by domain and version.
- PRIA agents use the catalogue to:
  - Classify incoming app specs
  - Suggest or enforce best-practice models, workflows, and layouts
  - Validate compliance and integration coverage

## 5. Governance & Extension

- All changes are versioned and reviewed by domain experts.
- New domains or updates follow a proposal and review workflow.
- Machine-readable and human-readable formats are kept in sync.