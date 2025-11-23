#!/usr/bin/env node

import { Command } from 'commander';
import { commitCommand } from '../src/commands/commit';

const program = new Command();

program
  .name('dev-cli')
  .description('A CLI tool for generating semantic commit messages')
  .version('1.0.0');

program
  .command('commit')
  .description('Generate a semantic commit message')
  .action(async () => {
    await commitCommand();
  });

program.parse();

