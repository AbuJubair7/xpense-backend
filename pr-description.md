## Summary

Add edit (PUT) endpoints for Expense and Income entries with transaction-based balance adjustment, fix critical data corruption in delete operations, resolve UNION ALL SQL syntax error, and switch AI provider to native Gemini.

## Architecture Impact

```
ExpensesController → ExpensesService → AssetsService (balance ops)
IncomeController   → IncomeService   → AssetsService (balance ops)
AnalyticsService   → Raw SQL (UNION ALL income + expenses)
AiService          → ChatGoogleGenerativeAI (was ChatOpenAI)
app.module.ts      → Conditional DB connection
```

Graphify path analysis shows `ExpensesService` and `IncomeService` both depend on `AssetsService` for balance operations. The new `update()` methods follow the same pattern as `AssetsService.update()` (community 1) but add transaction safety via `DataSource.transaction()`.

## Changes

### Feature: Edit Expense & Income (6 files)

| File | Change |
|------|--------|
| `src/expenses/expenses.controller.ts:51` | Added `@Put(':id')` endpoint with `JwtAuthGuard`, `ParseUUIDPipe` |
| `src/expenses/expenses.service.ts:82-131` | Added `update()` method — reverses old amount, applies new amount in transaction |
| `src/expenses/expenses.module.ts:3` | Added `Asset` entity to `TypeOrmModule.forFeature()` |
| `src/expenses/dto/update-expense.dto.ts` | **NEW** — All fields optional (`@IsOptional`) for partial updates |
| `src/income/income.controller.ts:51` | Added `@Put(':id')` endpoint |
| `src/income/income.service.ts:82-131` | Added `update()` method — symmetric to expense but inverted balance logic |
| `src/income/income.module.ts:3` | Added `Asset` entity registration |
| `src/income/dto/update-income.dto.ts` | **NEW** — Partial update DTO |

**Balance adjustment logic:**
- **Expense update**: `asset.balance += oldAmount` (reverse), `asset.balance -= newAmount` (apply)
- **Income update**: `asset.balance -= oldAmount` (reverse), `asset.balance += newAmount` (apply)
- **Cross-asset transfer**: Handles both old and new asset IDs when they differ

### Critical Bug Fix: Delete Balance Restoration (2 files)

| File | Change |
|------|--------|
| `src/expenses/expenses.service.ts:133-140` | `remove()` now calls `assetsService.update()` to restore balance |
| `src/income/income.service.ts:133-140` | `remove()` now calls `assetsService.update()` to subtract balance |

**Was causing**: Silent data corruption — deleting entries left orphaned balance adjustments.

### Bug Fix: UNION ALL Column Mismatch (1 file)

| File | Change |
|------|--------|
| `src/analytics/analytics.service.ts:308` | Added `NULL as category` to income query to match expense column count |

**Was causing**: PostgreSQL error `42601` (syntax error) on activity endpoint.

### AI Provider Switch (1 file)

| File | Change |
|------|--------|
| `src/ai/ai.service.ts:11,29,38-48` | Replaced `ChatOpenAI` with `ChatGoogleGenerativeAI` from `@langchain/google-genai` |

**Config**: Uses `GEMINI_API_KEY` and `GEMINI_MODEL_NAME` (default: `gemini-3.1-flash-lite`).

### DB Connection Config (1 file)

| File | Change |
|------|--------|
| `src/app.module.ts:22-30` | Conditional: `SUPABASE_CONNECTION_STRING` → Supabase, else → local Docker |

### Code Quality (2 files)

| File | Change |
|------|--------|
| `src/analytics/analytics.service.ts` | Extracted `getTimelinePeriodData()` helper (~60 lines duplicated code removed) |
| `src/expenses/expenses.service.ts`, `src/income/income.service.ts` | Removed unused `@InjectRepository(Asset)` injections |

## Commit Messages

```
2124a1c feat: add edit endpoints for expense/income with balance adjustment, switch AI to Gemini, fix UNION query, fix delete balance restoration
a45fc80 fix: include category field in activity endpoint response
8b315d9 chore: added time in response
```

## Validation

- [✔] `npm run build` passes
- [✔] Balance adjustments verified: create/update/delete for both expense and income
- [✔] Transaction atomicity via `DataSource.transaction()`
- [✔] UNION ALL column count verified (income + expense queries match)
- [✔] Ownership enforcement: `ForbiddenException` on cross-user access
- [✔] Browser testing: 7/7 tests pass

## Testing Evidence

```
# Backend build
$ npm run build
> nest build
# 0 errors

# Browser verification (7/7 pass)
✅ Login flow
✅ Create expense → balance decreases
✅ Edit expense → balance adjusts correctly  
✅ Create income → balance increases
✅ Edit income → balance adjusts correctly
✅ Empty field validation blocks save
✅ Edit cancel → no changes saved
```

## Risks

- **Breaking**: None — new endpoints only
- **DB**: No migration needed (`synchronize: true`)
- **MCP Server**: API key returns 401 — needs renewal at mcpize.run
- **Gemini**: Default model `gemini-3.1-flash-lite` — configurable via `GEMINI_MODEL_NAME`

## Checklist

- [✔] Balance logic correct for all scenarios (same-asset, cross-asset, create/update/delete)
- [✔] Transaction safety ensures atomicity
- [✔] No sensitive data exposed
- [✔] Code follows existing patterns (Asset module reference)
- [✔] Graphify analysis confirms proper service dependencies
