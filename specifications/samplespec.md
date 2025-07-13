{
  "description": "Expense Tracker MVP that lets employees submit expenses, managers approve them, and finance view reports.",
  "spec_version": "1.0.0",
  "domain": "finance",
  "schema": {
    "entities": {
      "User": {
        "id": { "type": "uuid", "description": "Primary key" },
        "email": { "type": "string", "description": "Login / identity" },
        "role": { "type": "enum", "values": ["EMPLOYEE", "MANAGER", "FINANCE"], "description": "Authorisation role" },
        "createdAt": { "type": "timestamp", "description": "Supabase row created time" }
      },
      "Expense": {
        "id": { "type": "uuid" },
        "userId": { "type": "uuid", "description": "FK → User.id" },
        "amount": { "type": "decimal(10,2)" },
        "currency": { "type": "string", "length": 3 },
        "description": { "type": "text" },
        "receiptUrl": { "type": "string", "description": "Public URL to receipt image" },
        "status": { "type": "enum", "values": ["SUBMITTED", "APPROVED", "REJECTED", "PAID"] },
        "submittedAt": { "type": "timestamp" },
        "updatedAt": { "type": "timestamp" }
      }
    }
  },
  "userActions": [
    {
      "actor": "EMPLOYEE",
      "name": "Submit Expense",
      "happyPath": "Employee fills a form, uploads receipt and submits. Status → SUBMITTED."
    },
    {
      "actor": "MANAGER",
      "name": "Approve / Reject Expense",
      "happyPath": "Manager views pending expenses, approves or rejects. Status → APPROVED or REJECTED."
    },
    {
      "actor": "FINANCE",
      "name": "Mark Expense Paid",
      "happyPath": "Finance marks an approved expense as paid. Status → PAID."
    }
  ],
  "authentication": {
    "allowUnauthenticated": false
  },
  "isConfirmed": true
}