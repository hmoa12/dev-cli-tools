import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import inquirer from 'inquirer';

interface RequestOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  saveHistory?: boolean;
}

interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: string;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  };
  timestamp: string;
}

/**
 * Get history file path
 */
function getHistoryFilePath(): string {
  return path.join(process.cwd(), '.apiteset-history.json');
}

/**
 * Format JSON with proper indentation
 */
function formatJson(data: string): string {
  try {
    const parsed = JSON.parse(data);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return data;
  }
}

/**
 * Parse headers from array of strings
 */
function parseHeaders(headerStrings: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  
  for (const headerString of headerStrings) {
    const colonIndex = headerString.indexOf(':');
    if (colonIndex === -1) {
      continue;
    }
    
    const key = headerString.substring(0, colonIndex).trim();
    const value = headerString.substring(colonIndex + 1).trim();
    headers[key] = value;
  }
  
  return headers;
}

/**
 * Make HTTP request
 */
function makeRequest(options: RequestOptions): Promise<{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(options.url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;

      // Prepare headers
      const headers: Record<string, string> = {
        ...options.headers,
      };

      // Set default Content-Type for POST/PUT/PATCH with body
      if (
        (options.method === 'POST' ||
          options.method === 'PUT' ||
          options.method === 'PATCH') &&
        options.body &&
        !headers['Content-Type']
      ) {
        headers['Content-Type'] = 'application/json';
      }

      // Prepare request options
      const requestOptions: any = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method,
        headers,
      };

      // Make request
      const req = client.request(requestOptions, (res) => {
        let responseBody = '';

        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          const responseHeaders: Record<string, string> = {};
          Object.keys(res.headers).forEach((key) => {
            const value = res.headers[key];
            if (Array.isArray(value)) {
              responseHeaders[key] = value.join(', ');
            } else if (value) {
              responseHeaders[key] = value;
            }
          });

          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: responseHeaders,
            body: responseBody,
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      // Send body if present
      if (options.body) {
        req.write(options.body);
      }

      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Save request/response to history
 */
async function saveToHistory(
  method: string,
  url: string,
  headers: Record<string, string> | undefined,
  body: string | undefined,
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  }
): Promise<void> {
  try {
    const historyPath = getHistoryFilePath();
    let history: HistoryEntry[] = [];

    // Load existing history
    try {
      const content = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(content);
    } catch {
      // File doesn't exist, start with empty array
    }

    // Create new entry
    const entry: HistoryEntry = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      method,
      url,
      headers,
      body,
      response,
      timestamp: new Date().toISOString(),
    };

    history.push(entry);

    // Keep only last 100 entries
    if (history.length > 100) {
      history = history.slice(-100);
    }

    // Save history
    await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    // Silently fail - history is not critical
    console.error(chalk.yellow('Warning: Could not save to history'));
  }
}

/**
 * Load history from file
 */
async function loadHistory(): Promise<HistoryEntry[]> {
  try {
    const historyPath = getHistoryFilePath();
    const content = await fs.readFile(historyPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

/**
 * Format history entry for display
 */
function formatHistoryEntry(entry: HistoryEntry, index: number): string {
  const statusColor =
    entry.response.status >= 200 && entry.response.status < 300
      ? chalk.green
      : entry.response.status >= 300 && entry.response.status < 400
      ? chalk.yellow
      : chalk.red;

  const date = new Date(entry.timestamp).toLocaleString();
  
  return `${chalk.gray(`${index + 1}.`)} ${chalk.cyan(entry.method)} ${entry.url} ${statusColor(
    `[${entry.response.status}]`
  )} ${chalk.gray(`(${date})`)}`;
}

/**
 * Execute API request
 */
export async function requestCommand(
  method: string,
  url: string,
  options: {
    headers?: string[];
    body?: string;
    editor?: boolean;
    noHistory?: boolean;
    interactiveHeaders?: boolean;
  }
): Promise<void> {
  try {
    // Validate URL
    try {
      new URL(url);
    } catch {
      console.error(chalk.red('Error: Invalid URL.'));
      process.exit(1);
    }

    let requestBody: string | undefined = options.body;
    let headers: Record<string, string> = {};

    // Parse headers from flags
    if (options.headers && options.headers.length > 0) {
      headers = parseHeaders(options.headers);
    }

    // Interactive headers
    if (options.interactiveHeaders) {
      const headerAnswers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'addContentType',
          message: 'Add Content-Type: application/json header?',
          default: true,
        },
        {
          type: 'input',
          name: 'authorization',
          message: 'Authorization header (Bearer token, Basic auth, etc.) [optional]:',
          default: '',
          when: (answers) => {
            return true; // Always ask
          },
        },
        {
          type: 'input',
          name: 'customHeader',
          message: 'Add custom header (format: Key:Value) [optional, press Enter to skip]:',
          default: '',
        },
      ]);

      if (headerAnswers.addContentType) {
        headers['Content-Type'] = 'application/json';
      }

      if (headerAnswers.authorization) {
        headers['Authorization'] = headerAnswers.authorization;
      }

      if (headerAnswers.customHeader) {
        const customParts = headerAnswers.customHeader.split(':');
        if (customParts.length === 2) {
          headers[customParts[0].trim()] = customParts[1].trim();
        }
      }
    }

    // Handle request body
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      if (options.editor) {
        const bodyAnswer = await inquirer.prompt([
          {
            type: 'editor',
            name: 'body',
            message: 'Enter request body (JSON):',
            default: requestBody || '{}',
          },
        ]);
        requestBody = bodyAnswer.body;

        // Validate JSON
        try {
          JSON.parse(requestBody);
        } catch {
          console.error(chalk.red('Error: Invalid JSON in request body.'));
          process.exit(1);
        }
      } else if (requestBody) {
        // Validate provided body
        try {
          JSON.parse(requestBody);
        } catch {
          console.error(chalk.red('Error: Invalid JSON in request body.'));
          process.exit(1);
        }
      }
      // If no body provided and not using editor, body will be undefined (optional for some endpoints)
    }

    // Make request
    console.log(chalk.blue(`\n${method} ${url}\n`));

    const response = await makeRequest({
      method,
      url,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: requestBody,
      saveHistory: !options.noHistory,
    });

    // Display response
    const statusColor =
      response.status >= 200 && response.status < 300
        ? chalk.green
        : response.status >= 300 && response.status < 400
        ? chalk.yellow
        : chalk.red;

    console.log(
      statusColor(
        `Status: ${response.status} ${response.statusText || ''}`
      )
    );

    // Display response headers (optional - can be toggled)
    // console.log(chalk.gray('\nResponse Headers:'));
    // Object.entries(response.headers).forEach(([key, value]) => {
    //   console.log(chalk.gray(`  ${key}: ${value}`));
    // });

    // Format and display response body
    console.log(chalk.cyan('\nResponse Body:'));
    try {
      const formatted = formatJson(response.body);
      console.log(formatted);
    } catch {
      console.log(response.body);
    }

    console.log('');

    // Save to history
    if (!options.noHistory) {
      await saveToHistory(
        method,
        url,
        Object.keys(headers).length > 0 ? headers : undefined,
        requestBody,
        response
      );
    }
  } catch (error: any) {
    console.error(chalk.red('Error making request:'), error.message);
    process.exit(1);
  }
}

/**
 * View request history
 */
export async function historyCommand(options: { clear?: boolean }): Promise<void> {
  try {
    if (options.clear) {
      const historyPath = getHistoryFilePath();
      try {
        await fs.unlink(historyPath);
        console.log(chalk.green('✓ History cleared.'));
      } catch {
        console.log(chalk.yellow('History file does not exist.'));
      }
      return;
    }

    const history = await loadHistory();

    if (history.length === 0) {
      console.log(chalk.yellow('No history found.'));
      return;
    }

    console.log(chalk.cyan(`\nAPI Request History (${history.length} entries):\n`));

    // Display history in reverse order (newest first)
    const reversedHistory = [...history].reverse();
    reversedHistory.forEach((entry, index) => {
      console.log(formatHistoryEntry(entry, reversedHistory.length - index - 1));
    });

    console.log('');

    // Option to view details or replay
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'View details of a request', value: 'view' },
          { name: 'Replay a request', value: 'replay' },
          { name: 'Exit', value: 'exit' },
        ],
      },
    ]);

    if (answer.action === 'exit') {
      return;
    }

    if (answer.action === 'view' || answer.action === 'replay') {
      const entryChoices = reversedHistory.map((entry, index) => ({
        name: formatHistoryEntry(entry, reversedHistory.length - index - 1),
        value: reversedHistory.length - index - 1,
      }));

      const selectedAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'entryIndex',
          message: 'Select a request:',
          choices: entryChoices,
        },
      ]);

      const selectedEntry = history[selectedAnswer.entryIndex];

      if (answer.action === 'view') {
        // Display full details
        console.log(chalk.cyan('\nRequest Details:\n'));
        console.log(chalk.yellow('Method:'), selectedEntry.method);
        console.log(chalk.yellow('URL:'), selectedEntry.url);
        if (selectedEntry.headers && Object.keys(selectedEntry.headers).length > 0) {
          console.log(chalk.yellow('Headers:'));
          Object.entries(selectedEntry.headers).forEach(([key, value]) => {
            console.log(chalk.gray(`  ${key}: ${value}`));
          });
        }
        if (selectedEntry.body) {
          console.log(chalk.yellow('Body:'));
          console.log(formatJson(selectedEntry.body));
        }
        console.log(chalk.yellow('\nResponse:'));
        console.log(
          chalk.green(`Status: ${selectedEntry.response.status} ${selectedEntry.response.statusText}`)
        );
        console.log(chalk.yellow('Body:'));
        try {
          console.log(formatJson(selectedEntry.response.body));
        } catch {
          console.log(selectedEntry.response.body);
        }
        console.log('');
      } else if (answer.action === 'replay') {
        // Replay request
        await requestCommand(
          selectedEntry.method,
          selectedEntry.url,
          {
            headers: selectedEntry.headers
              ? Object.entries(selectedEntry.headers).map(([k, v]) => `${k}: ${v}`)
              : undefined,
            body: selectedEntry.body,
            noHistory: false, // Save replay to history too
          }
        );
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      process.exit(0);
    } else {
      console.error(chalk.red('Error viewing history:'), error);
      process.exit(1);
    }
  }
}

