#!/usr/bin/env node

import { Command } from 'commander';
import { commitCommand } from '../src/commands/commit';
import { readmeCommand } from '../src/commands/readme';

const program = new Command();

program
  .name('dev-cli')
  .description('A CLI tool for generating semantic commit messages and README files')
  .version('1.0.0');

program
  .command('commit')
  .description('Generate a semantic commit message')
  .option('--push', 'Automatically commit and push after generating the message')
  .action(async (options) => {
    await commitCommand(options);
  });

program
  .command('readme')
  .description('Generate a beautiful README.md file')
  .argument('[output-path]', 'Output path for README.md (default: ./README.md)')
  .option('--no-install', 'Skip installation section')
  .option('--minimal', 'Generate minimal README (name, description, license only)')
  .option('-o, --output <path>', 'Output path for README.md (alternative to positional argument)')
  .action(async (outputPath, options) => {
    // Use positional argument if provided, otherwise use the --output flag
    const finalPath = outputPath || options.output;
    await readmeCommand({ ...options, output: finalPath });
  });

program.parse();

