# Finance Tracker

Monthly personal finance app that imports **PDF bank and credit card statements**, classifies expenses by category, tracks spending against monthly budgets, and suggests transfers between accounts.

## Features (v0.1)

- **PDF statement upload** — extracts transactions from text-based PDFs
- **Auto-categorization** — keyword rules with user correction learning
- **Monthly budgets** — per-category spending targets
- **Dashboard** — spend vs budget, overspend/savings alerts
- **Transfer suggestions** — pay credit card, sweep surplus to savings
- **Transaction review** — confirm or fix low-confidence categories

## Tech stack

- Next.js 16 (App Router)
- TypeScript + Tailwind CSS
- Prisma + SQLite (local dev)
- pdf-parse for PDF text extraction

## Getting started

```bash
cd ~/Projects/finance-tracker
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Workflow

1. **Budgets** — set monthly targets per category
2. **Upload** — import a PDF statement and pick the account
3. **Transactions** — review and fix categories
4. **Dashboard** — see spending progress, alerts, and transfer suggestions

## PDF parsing notes

The parser works best with **text-based** PDF exports (not scanned images). It looks for lines containing:

- A date (`DD/MM/YYYY`, `MM/DD/YYYY`, or `01 Jul 2026`)
- A description
- An amount (optionally with `DR` / `CR` suffix)

If no transactions are detected, try exporting CSV from your bank or use a different PDF layout.

## Project structure

```
app/
  (app)/          # Dashboard, upload, budgets, transactions
  api/            # REST endpoints
lib/
  pdf-parser.ts   # PDF extraction + transaction parsing
  categorizer.ts  # Rule-based classification
  budget.ts       # Monthly summaries + alerts
  transfers.ts    # Transfer suggestion engine
prisma/
  schema.prisma   # Data model
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:seed` | Seed default user, accounts, categories |
| `npm run db:studio` | Open Prisma Studio |

## Roadmap

- [ ] Bank-specific PDF templates
- [ ] CSV/OFX import
- [ ] Multi-user auth
- [ ] PostgreSQL for production
- [ ] Push/email notifications
- [ ] Plaid / open banking for live balances
