<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 🛑 CRITICAL PROJECT RULES: Accuracy & Localization 🛑

This is a financial analytics application. **Accuracy is our absolute highest priority**.
A single calculation error in price interpolation, stock splits, dividends, or cost basis will invalidate the entire report.

When working on this project, you MUST abide by the following rules:

1. **Precision over Breadth:** Do not rush to implement large swathes of code. Go slow. Prioritize absolute correctness in logic, mathematics, and edge-case handling over adding new features quickly.
2. **Hyper-Localized Changes:** Make the smallest, most surgical changes possible to achieve the goal. Do NOT perform broad refactoring, formatting changes, or "cleanups" outside the explicit scope of the task. 
3. **Think Through Math & Logic:** Before modifying any code in `functions/src/index.ts` (especially the parsing or `computePortfolio` algorithms), write out a step-by-step logical proof of how your change interacts with:
   - Zero or negative values
   - Missing data points or dates
   - Retrospective split adjustments
   - Cost basis averaging
4. **Test Before Moving On:** If you make a logic change, mentally (or via scratchpad) run through an edge case to ensure it doesn't break existing historical calculations.
5. **No Assumptions:** If a requirement or a data format is ambiguous, **STOP AND ASK**. Do not guess how financial data should be handled.
6. **Immutable Math Engine:** Nothing changes the current math engine or code. New features MUST always be built as add-ons on top to ensure nothing on the base breaks. This is very important.
