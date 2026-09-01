import { fetchNseCorporateActions } from './src/services/nseFetcher';

async function run() {
  console.log("Testing scraper for RELIANCE.NS...");
  const actions = await fetchNseCorporateActions('RELIANCE.NS');
  console.log("Found Actions:");
  console.log(JSON.stringify(actions, null, 2));
}

run();
