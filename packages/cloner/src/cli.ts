#!/usr/bin/env node
import { program } from 'commander';
import { resolve } from 'path';
import { logger } from './logger.js';
import { runClone } from './runClone.js';
import { startServer } from './server.js';

program
  .name('cloner')
  .description('Web cloner: captures JS-heavy sites and generates a Next.js full-stack clone')
  .version('0.1.0');

program
  .command('clone <url>')
  .description('Clone a website')
  .option('-o, --out <dir>', 'Output directory', './output/site')
  .option('-m, --max-pages <n>', 'Max pages to crawl', '50')
  .option('-d, --depth <n>', 'Max link depth', '3')
  .option('-c, --concurrency <n>', 'Concurrent browser contexts', '2')
  .option('--ignore-robots', 'Skip robots.txt check', false)
  .option('-v, --verbose', 'Print DEBUG lines to console (all detail goes to log file regardless)', false)
  .action(async (url: string, options: {
    out: string;
    maxPages: string;
    depth: string;
    concurrency: string;
    ignoreRobots: boolean;
    verbose: boolean;
  }) => {
    await runClone({
      url,
      out: resolve(options.out),
      maxPages: parseInt(options.maxPages, 10),
      depth: parseInt(options.depth, 10),
      concurrency: parseInt(options.concurrency, 10),
      ignoreRobots: options.ignoreRobots,
      verbose: options.verbose,
    });
  });

program
  .command('serve')
  .description('Start the web UI for cloning and editing sites')
  .option('-p, --port <n>', 'Port to listen on', '3333')
  .option('-o, --out <dir>', 'Base output directory for cloned sites', './output')
  .action(async (options: { port: string; out: string }) => {
    const port = parseInt(options.port, 10);
    const outDir = resolve(options.out);
    await startServer(outDir, port);
  });

program.parseAsync(process.argv).catch((err) => {
  logger.error('Fatal error', err);
  logger.close();
  process.exit(1);
});
