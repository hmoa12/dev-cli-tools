import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
  rawLine?: string;
}

/**
 * Get the path to the .env file (defaults to .env in project root)
 */
function getEnvFilePath(fileName: string = '.env'): string {
  return path.join(process.cwd(), fileName);
}

/**
 * Read and parse .env file content
 * Returns a map of key-value pairs and preserves comments/empty lines
 */
async function readEnvFile(filePath: string): Promise<Map<string, EnvEntry>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return parseEnvContent(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty map
      return new Map();
    }
    throw error;
  }
}

/**
 * Parse .env file content into a map
 * Handles comments, empty lines, quoted values
 */
function parseEnvContent(content: string): Map<string, EnvEntry> {
  const envMap = new Map<string, EnvEntry>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines and comments
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue;
    }

    // Parse KEY=VALUE format
    const match = trimmedLine.match(/^([^=#]+?)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Handle quoted values
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envMap.set(key, {
        key,
        value,
        rawLine: line,
      });
    }
  }

  return envMap;
}

/**
 * Format environment variables back to .env file content
 * Preserves the original formatting as much as possible
 */
function formatEnvContent(envMap: Map<string, EnvEntry>, originalContent?: string): string {
  if (originalContent) {
    // Try to preserve original formatting
    const lines = originalContent.split('\n');
    const newLines: string[] = [];
    const processedKeys = new Set<string>();

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Keep comments and empty lines as-is
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      // Update existing entries
      const match = trimmedLine.match(/^([^=#]+?)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        if (envMap.has(key)) {
          const entry = envMap.get(key)!;
          newLines.push(`${key}=${escapeValue(entry.value)}`);
          processedKeys.add(key);
          continue;
        }
      }
    }

    // Add new entries that weren't in the original file
    for (const [key, entry] of envMap) {
      if (!processedKeys.has(key)) {
        newLines.push(`${key}=${escapeValue(entry.value)}`);
      }
    }

    return newLines.join('\n') + '\n';
  } else {
    // Simple formatting for new files
    const lines: string[] = [];
    for (const [key, entry] of envMap) {
      lines.push(`${key}=${escapeValue(entry.value)}`);
    }
    return lines.join('\n') + '\n';
  }
}

/**
 * Escape value if it contains spaces or special characters
 */
function escapeValue(value: string): string {
  if (value.includes(' ') || value.includes('=') || value.includes('#')) {
    // Quote if contains spaces or special characters
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

/**
 * Write environment variables to .env file
 */
async function writeEnvFile(filePath: string, envMap: Map<string, EnvEntry>, originalContent?: string): Promise<void> {
  const content = formatEnvContent(envMap, originalContent);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Ensure .env file exists, create it if it doesn't
 */
async function ensureEnvFile(filePath: string): Promise<Map<string, EnvEntry>> {
  try {
    await fs.access(filePath);
    // File exists, read it
    const content = await fs.readFile(filePath, 'utf-8');
    return parseEnvContent(content);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, create empty file
      await fs.writeFile(filePath, '', 'utf-8');
      return new Map();
    }
    throw error;
  }
}

/**
 * Set an environment variable
 */
export async function setCommand(key: string, value: string, envFile?: string): Promise<void> {
  try {
    // Validate key
    if (!key || key.trim().length === 0) {
      console.error(chalk.red('Error: Key cannot be empty.'));
      process.exit(1);
    }

    if (key.includes(' ') || key.includes('=')) {
      console.error(chalk.red('Error: Key cannot contain spaces or equals sign.'));
      process.exit(1);
    }

    const filePath = getEnvFilePath(envFile || '.env');
    let originalContent: string | undefined;
    
    try {
      originalContent = await fs.readFile(filePath, 'utf-8');
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
    }

    const envMap = await ensureEnvFile(filePath);
    
    // Check if key already exists
    const keyExists = envMap.has(key);
    
    // Set the value
    envMap.set(key, {
      key: key.trim(),
      value: value.trim(),
    });

    // Write back to file
    await writeEnvFile(filePath, envMap, originalContent);

    if (keyExists) {
      console.log(chalk.green(`✓ Updated ${key} in ${path.basename(filePath)}`));
    } else {
      console.log(chalk.green(`✓ Added ${key} to ${path.basename(filePath)}`));
    }
  } catch (error) {
    console.error(chalk.red('Error setting environment variable:'), error);
    process.exit(1);
  }
}

/**
 * Delete an environment variable
 */
export async function deleteCommand(key: string, envFile?: string): Promise<void> {
  try {
    const filePath = getEnvFilePath(envFile || '.env');
    const isProdOrDev = envFile === '.env.production' || envFile === '.env.development';

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envMap = parseEnvContent(content);

      if (!envMap.has(key)) {
        console.error(chalk.red(`Error: Key "${key}" not found in ${path.basename(filePath)}.`));
        process.exit(1);
      }

      envMap.delete(key);

      // Rebuild content without the deleted key
      await writeEnvFile(filePath, envMap, content);

      console.log(chalk.green(`✓ Deleted ${key} from ${path.basename(filePath)}`));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // If using --prod or --dev, create the file
        if (isProdOrDev) {
          await fs.writeFile(filePath, '', 'utf-8');
          console.error(chalk.red(`Error: Key "${key}" not found in ${path.basename(filePath)} (file was just created).`));
        } else {
          console.error(chalk.red(`Error: ${path.basename(filePath)} does not exist.`));
        }
        process.exit(1);
      }
      throw error;
    }
  } catch (error) {
    console.error(chalk.red('Error deleting environment variable:'), error);
    process.exit(1);
  }
}

/**
 * Get an environment variable value
 */
export async function getCommand(key: string, envFile?: string): Promise<void> {
  try {
    const filePath = getEnvFilePath(envFile || '.env');
    const isProdOrDev = envFile === '.env.production' || envFile === '.env.development';

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envMap = parseEnvContent(content);

      if (!envMap.has(key)) {
        console.error(chalk.red(`Error: Key "${key}" not found in ${path.basename(filePath)}.`));
        process.exit(1);
      }

      const entry = envMap.get(key)!;
      console.log(entry.value);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // If using --prod or --dev, create the file
        if (isProdOrDev) {
          await fs.writeFile(filePath, '', 'utf-8');
          console.error(chalk.red(`Error: Key "${key}" not found in ${path.basename(filePath)} (file was just created).`));
        } else {
          console.error(chalk.red(`Error: ${path.basename(filePath)} does not exist.`));
        }
        process.exit(1);
      }
      throw error;
    }
  } catch (error) {
    console.error(chalk.red('Error getting environment variable:'), error);
    process.exit(1);
  }
}

/**
 * List all environment variables
 */
export async function listCommand(envFile?: string): Promise<void> {
  try {
    const filePath = getEnvFilePath(envFile || '.env');

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const envMap = parseEnvContent(content);

      if (envMap.size === 0) {
        console.log(chalk.yellow(`No environment variables found in ${path.basename(filePath)}.`));
        return;
      }

      console.log(chalk.cyan(`\nEnvironment variables in ${path.basename(filePath)}:\n`));
      for (const [key, entry] of envMap) {
        const displayValue = entry.value.length > 50 
          ? entry.value.substring(0, 47) + '...' 
          : entry.value;
        console.log(chalk.green(`${key}`) + chalk.gray(' = ') + chalk.white(displayValue));
      }
      console.log('');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(chalk.red(`Error: ${path.basename(filePath)} does not exist.`));
        process.exit(1);
      }
      throw error;
    }
  } catch (error) {
    console.error(chalk.red('Error listing environment variables:'), error);
    process.exit(1);
  }
}

/**
 * Switch between different .env files
 */
export async function switchCommand(envFile: string): Promise<void> {
  try {
    const filePath = getEnvFilePath(envFile);
    const defaultEnvPath = getEnvFilePath('.env');

    // Check if the target .env file exists
    try {
      await fs.access(filePath);
      console.log(chalk.green(`✓ Switched to ${envFile}`));
      
      // Optionally, create a symlink or copy to .env
      // For simplicity, we'll just inform the user
      const content = await fs.readFile(filePath, 'utf-8');
      await fs.writeFile(defaultEnvPath, content, 'utf-8');
      
      console.log(chalk.green(`✓ Copied ${envFile} to .env`));
      console.log(chalk.gray(`\nActive .env file is now: ${envFile}\n`));
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // Check if other .env files exist
        const dir = process.cwd();
        const files = await fs.readdir(dir);
        const envFiles = files.filter(f => f.startsWith('.env'));
        
        if (envFiles.length === 0) {
          // Create new .env file from scratch
          await fs.writeFile(filePath, '', 'utf-8');
          console.log(chalk.green(`✓ Created new ${envFile}`));
          console.log(chalk.yellow(`Note: To make this active, copy it to .env manually or use this command again.`));
        } else {
          console.error(chalk.red(`Error: ${envFile} does not exist.`));
          console.log(chalk.yellow(`\nAvailable .env files:`));
          envFiles.forEach(file => {
            console.log(chalk.gray(`  - ${file}`));
          });
          console.log('');
          process.exit(1);
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error(chalk.red('Error switching environment file:'), error);
    process.exit(1);
  }
}

