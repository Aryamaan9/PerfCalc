const fs = require('fs');
const file = 'c:/Users/aryam/OneDrive/Documents/portfolio-analyzer/portfolio-analyzer/src/lib/advancedEngine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/const holdings: Record<string, number> = {};/g, 'const holdings: Record<string, number> = {};\n  const lots: Record<string, BuyLot[]> = {};');

const target = `if (!costBases[t.symbol]) costBases[t.symbol] = { shares: 0, cost: 0 };
          costBases[t.symbol].shares += t.qty;
          costBases[t.symbol].cost += cost;
        } else if (s === "sell" || s === "transfer out" || s === "transfer_out") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) - t.qty; // Allow negative for audit
          if (costBases[t.symbol] && costBases[t.symbol].shares > 0) {
            const avgPrice = costBases[t.symbol].cost / costBases[t.symbol].shares;
            costBases[t.symbol].shares = Math.max(0, costBases[t.symbol].shares - t.qty);
            costBases[t.symbol].cost = costBases[t.symbol].shares * avgPrice;
          }
        }`;

const replacement = `if (!lots[t.symbol]) lots[t.symbol] = [];
          lots[t.symbol].push({ date: t.date, qty: t.qty, totalCost: cost });
        } else if (s === "sell" || s === "transfer out" || s === "transfer_out") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) - t.qty;
          let sharesToSell = t.qty;
          if (lots[t.symbol]) {
            while (sharesToSell > 0 && lots[t.symbol].length > 0) {
              const lot = lots[t.symbol][0];
              if (lot.qty <= sharesToSell) {
                sharesToSell -= lot.qty;
                lots[t.symbol].shift();
              } else {
                const proportion = sharesToSell / lot.qty;
                lot.totalCost -= lot.totalCost * proportion;
                lot.qty -= sharesToSell;
                sharesToSell = 0;
              }
            }
          }
        }`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
