#!/usr/bin/env node

import { Command } from 'commander';
import { commitCommand } from '../src/commands/commit';
import { readmeCommand } from '../src/commands/readme';
import { setCommand, deleteCommand, getCommand, listCommand, switchCommand } from '../src/commands/envset';
import { cleanCommand } from '../src/commands/cleaner';
import { requestCommand, historyCommand } from '../src/commands/apitest';

const program = new Command();

program
  .name('dev-cli')
  .description('A comprehensive CLI toolkit for developers: semantic commits, README generation, environment management, project cleanup, and API testing')
  .version('1.0.1');

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

// Environment variable manager
const envsetCommand = program
  .command('envset')
  .description('Manage environment variables in .env files');

envsetCommand
  .command('set')
  .description('Set an environment variable')
  .argument('<key>', 'Environment variable key')
  .argument('<value...>', 'Environment variable value (use quotes for values with spaces)')
  .option('-f, --file <file>', 'Specify .env file (default: .env)')
  .option('--prod', 'Use .env.production file')
  .option('--dev', 'Use .env.development file')
  .action(async (key, valueParts, options) => {
    // Join value parts in case of spaces (commander.js splits by default)
    const value = Array.isArray(valueParts) ? valueParts.join(' ') : valueParts;
    const envFile = options.prod ? '.env.production' : options.dev ? '.env.development' : (options.file || '.env');
    await setCommand(key, value, envFile);
  });

envsetCommand
  .command('delete')
  .alias('del')
  .description('Delete an environment variable')
  .argument('<key>', 'Environment variable key to delete')
  .option('-f, --file <file>', 'Specify .env file (default: .env)')
  .option('--prod', 'Use .env.production file')
  .option('--dev', 'Use .env.development file')
  .action(async (key, options) => {
    const envFile = options.prod ? '.env.production' : options.dev ? '.env.development' : (options.file || '.env');
    await deleteCommand(key, envFile);
  });

envsetCommand
  .command('get')
  .description('Get an environment variable value')
  .argument('<key>', 'Environment variable key')
  .option('-f, --file <file>', 'Specify .env file (default: .env)')
  .option('--prod', 'Use .env.production file')
  .option('--dev', 'Use .env.development file')
  .action(async (key, options) => {
    const envFile = options.prod ? '.env.production' : options.dev ? '.env.development' : (options.file || '.env');
    await getCommand(key, envFile);
  });

envsetCommand
  .command('list')
  .alias('ls')
  .description('List all environment variables')
  .option('-f, --file <file>', 'Specify .env file (default: .env)', '.env')
  .action(async (options) => {
    await listCommand(options.file);
  });

envsetCommand
  .command('switch')
  .description('Switch between different .env files')
  .argument('<env-file>', 'Target .env file (e.g., .env.production, .env.development)')
  .action(async (envFile) => {
    await switchCommand(envFile);
  });

program
  .command('cleaner')
  .description('Clean junk files and directories from a project')
  .argument('[project-path]', 'Project path to clean (default: current directory)', process.cwd())
  .option('--node_modules', 'Only delete node_modules directory')
  .option('--force', 'Skip confirmation prompt')
  .option('--dry-run', 'Show what would be deleted without actually deleting')
  .action(async (projectPath, options) => {
    // Handle both node_modules and nodeModules (commander.js converts differently)
    const cleanOptions = {
      nodeModules: options.node_modules || (options as any).nodeModules || false,
      force: options.force || false,
      dryRun: options.dryRun || (options as any).dry_run || false,
    };
    await cleanCommand(projectPath, cleanOptions);
  });

// API Tester
const apitestCommand = program
  .command('apitest')
  .description('Test APIs with GET, POST, PUT, PATCH, DELETE methods');

// GET request
apitestCommand
  .command('get')
  .alias('GET')
  .description('Make a GET request')
  .argument('<url>', 'API endpoint URL')
  .option('-H, --header <header>', 'HTTP header (format: Key:Value)', [])
  .option('--no-history', 'Skip saving to history')
  .option('--interactive-headers', 'Set headers interactively')
  .action(async (url, options) => {
    const headers = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
    await requestCommand('GET', url, {
      headers,
      noHistory: options.noHistory || false,
      interactiveHeaders: options.interactiveHeaders || false,
    });
  });

// POST request
apitestCommand
  .command('post')
  .alias('POST')
  .description('Make a POST request')
  .argument('<url>', 'API endpoint URL')
  .option('-b, --body <body>', 'Request body (JSON string)')
  .option('-e, --editor', 'Open editor for request body')
  .option('-H, --header <header>', 'HTTP header (format: Key:Value)', [])
  .option('--no-history', 'Skip saving to history')
  .option('--interactive-headers', 'Set headers interactively')
  .action(async (url, options) => {
    const headers = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
    await requestCommand('POST', url, {
      headers,
      body: options.body,
      editor: options.editor || false,
      noHistory: options.noHistory || false,
      interactiveHeaders: options.interactiveHeaders || false,
    });
  });

// PUT request
apitestCommand
  .command('put')
  .alias('PUT')
  .description('Make a PUT request')
  .argument('<url>', 'API endpoint URL')
  .option('-b, --body <body>', 'Request body (JSON string)')
  .option('-e, --editor', 'Open editor for request body')
  .option('-H, --header <header>', 'HTTP header (format: Key:Value)', [])
  .option('--no-history', 'Skip saving to history')
  .option('--interactive-headers', 'Set headers interactively')
  .action(async (url, options) => {
    const headers = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
    await requestCommand('PUT', url, {
      headers,
      body: options.body,
      editor: options.editor || false,
      noHistory: options.noHistory || false,
      interactiveHeaders: options.interactiveHeaders || false,
    });
  });

// PATCH request
apitestCommand
  .command('patch')
  .alias('PATCH')
  .description('Make a PATCH request')
  .argument('<url>', 'API endpoint URL')
  .option('-b, --body <body>', 'Request body (JSON string)')
  .option('-e, --editor', 'Open editor for request body')
  .option('-H, --header <header>', 'HTTP header (format: Key:Value)', [])
  .option('--no-history', 'Skip saving to history')
  .option('--interactive-headers', 'Set headers interactively')
  .action(async (url, options) => {
    const headers = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
    await requestCommand('PATCH', url, {
      headers,
      body: options.body,
      editor: options.editor || false,
      noHistory: options.noHistory || false,
      interactiveHeaders: options.interactiveHeaders || false,
    });
  });

// DELETE request
apitestCommand
  .command('delete')
  .alias('DELETE')
  .description('Make a DELETE request')
  .argument('<url>', 'API endpoint URL')
  .option('-H, --header <header>', 'HTTP header (format: Key:Value)', [])
  .option('--no-history', 'Skip saving to history')
  .option('--interactive-headers', 'Set headers interactively')
  .action(async (url, options) => {
    const headers = Array.isArray(options.header) ? options.header : (options.header ? [options.header] : []);
    await requestCommand('DELETE', url, {
      headers,
      noHistory: options.noHistory || false,
      interactiveHeaders: options.interactiveHeaders || false,
    });
  });

// History command
apitestCommand
  .command('history')
  .description('View API request history')
  .option('--clear', 'Clear all history')
  .action(async (options) => {
    await historyCommand(options);
  });

program.parse();

