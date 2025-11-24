import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';
import inquirer from 'inquirer';

interface CleanOptions {
  nodeModules?: boolean;
  force?: boolean;
  dryRun?: boolean;
}

interface JunkItem {
  path: string;
  type: 'file' | 'directory';
  size: number;
}

/**
 * Get list of junk file patterns and directory names to clean
 */
function getJunkFilesAndDirs(): {
  directories: string[];
  filePatterns: string[];
} {
  return {
    directories: [
      'node_modules',
      'dist',
      'build',
      'out',
      '.cache',
      'cache',
      'coverage',
      '.nyc_output',
      '.next',
      '.nuxt',
      '.svelte-kit',
      '.vite',
      '.parcel-cache',
      'tmp',
      'temp',
      '.tmp',
      '__pycache__',
      '.pytest_cache',
      '.mypy_cache',
      '.ruff_cache',
    ],
    filePatterns: [
      '.DS_Store',
      'Thumbs.db',
      '*.swp',
      '*.swo',
      '*~',
      '*.log',
      '*.tmp',
      '*.pyc',
      '.DS_Store',
    ],
  };
}

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Calculate size of file or directory recursively
 */
async function calculateSize(itemPath: string, stats: any): Promise<number> {
  try {
    if (stats.isDirectory()) {
      let totalSize = 0;
      const entries = await fs.readdir(itemPath);
      for (const entry of entries) {
        const entryPath = path.join(itemPath, entry);
        try {
          const entryStats = await fs.stat(entryPath);
          totalSize += await calculateSize(entryPath, entryStats);
        } catch {
          // Skip files we can't access
        }
      }
      return totalSize;
    } else {
      return stats.size;
    }
  } catch {
    return 0;
  }
}

/**
 * Recursively find junk files and directories
 */
async function findJunkFiles(
  projectPath: string,
  options: CleanOptions
): Promise<JunkItem[]> {
  const junkItems: JunkItem[] = [];
  const { directories, filePatterns } = getJunkFilesAndDirs();

  async function scanDirectory(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(projectPath, entryPath);

        // Skip .git directory
        if (entry.name === '.git' || relativePath.includes('.git/')) {
          continue;
        }

        try {
          const stats = await fs.stat(entryPath);

          if (entry.isDirectory()) {
            // Check if this directory should be deleted
            if (options.nodeModules) {
              // Only delete node_modules
              if (entry.name === 'node_modules') {
                const size = await calculateSize(entryPath, stats);
                junkItems.push({
                  path: entryPath,
                  type: 'directory',
                  size,
                });
                continue; // Don't scan inside node_modules
              }
            } else {
              // Check against junk directories list
              if (directories.includes(entry.name)) {
                const size = await calculateSize(entryPath, stats);
                junkItems.push({
                  path: entryPath,
                  type: 'directory',
                  size,
                });
                continue; // Don't scan inside directories we're deleting
              }
            }

            // Recursively scan subdirectories
            await scanDirectory(entryPath);
          } else if (entry.isFile()) {
            // Check if this file matches junk patterns
            if (!options.nodeModules) {
              // Check file patterns
              const matchesPattern = filePatterns.some((pattern) => {
                if (pattern.includes('*')) {
                  const regex = new RegExp(
                    '^' + pattern.replace(/\*/g, '.*') + '$'
                  );
                  return regex.test(entry.name);
                }
                return entry.name === pattern;
              });

              if (matchesPattern) {
                const size = await calculateSize(entryPath, stats);
                junkItems.push({
                  path: entryPath,
                  type: 'file',
                  size,
                });
              }
            }
          }
        } catch {
          // Skip files/dirs we can't access
        }
      }
    } catch {
      // Skip directories we can't access
    }
  }

  await scanDirectory(projectPath);
  return junkItems;
}

/**
 * Safely delete file or directory recursively
 */
async function deleteFileOrDir(itemPath: string): Promise<void> {
  try {
    const stats = await fs.stat(itemPath);

    if (stats.isDirectory()) {
      // Delete directory recursively
      const entries = await fs.readdir(itemPath);
      for (const entry of entries) {
        const entryPath = path.join(itemPath, entry);
        await deleteFileOrDir(entryPath);
      }
      await fs.rmdir(itemPath);
    } else {
      // Delete file
      await fs.unlink(itemPath);
    }
  } catch (error: any) {
    // Handle permission errors or files in use
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Main clean command
 */
export async function cleanCommand(
  projectPath: string,
  options: CleanOptions = {}
): Promise<void> {
  try {
    // Resolve project path
    const resolvedPath = path.resolve(projectPath || process.cwd());

    // Validate path exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isDirectory()) {
        console.error(chalk.red(`Error: ${resolvedPath} is not a directory.`));
        process.exit(1);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(chalk.red(`Error: Path ${resolvedPath} does not exist.`));
        process.exit(1);
      }
      throw error;
    }

    console.log(chalk.blue(`Scanning for junk files in: ${resolvedPath}\n`));

    // Find junk files
    const junkItems = await findJunkFiles(resolvedPath, options);

    if (junkItems.length === 0) {
      console.log(chalk.green('✓ No junk files found. Project is clean!'));
      return;
    }

    // Calculate total size
    const totalSize = junkItems.reduce((sum, item) => sum + item.size, 0);

    // Display what will be deleted
    console.log(chalk.yellow(`Found ${junkItems.length} junk item(s) to delete:\n`));
    
    // Group by type
    const directories = junkItems.filter((item) => item.type === 'directory');
    const files = junkItems.filter((item) => item.type === 'file');

    if (directories.length > 0) {
      console.log(chalk.cyan('Directories:'));
      directories.forEach((item) => {
        const relativePath = path.relative(resolvedPath, item.path);
        console.log(
          `  ${chalk.red('✗')} ${relativePath} ${chalk.gray(`(${formatSize(item.size)})`)}`
        );
      });
      console.log('');
    }

    if (files.length > 0) {
      console.log(chalk.cyan('Files:'));
      files.forEach((item) => {
        const relativePath = path.relative(resolvedPath, item.path);
        console.log(
          `  ${chalk.red('✗')} ${relativePath} ${chalk.gray(`(${formatSize(item.size)})`)}`
        );
      });
      console.log('');
    }

    console.log(
      chalk.yellow(`Total size to free: ${chalk.bold(formatSize(totalSize))}\n`)
    );

    // If --dry-run flag, show what would be deleted and exit
    if (options.dryRun) {
      console.log(chalk.blue('🔍 DRY RUN MODE - No files will be deleted\n'));
      console.log(
        chalk.gray(
          `This is a preview. Run without --dry-run to actually delete these files.`
        )
      );
      return;
    }

    // Ask for confirmation unless --force flag is set
    if (!options.force) {
      const answer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: 'Do you want to delete these files?',
          default: false,
        },
      ]);

      if (!answer.confirm) {
        console.log(chalk.gray('Operation cancelled.'));
        return;
      }
    }

    // Delete files
    console.log(chalk.blue('\nDeleting junk files...\n'));

    let deletedCount = 0;
    let errorCount = 0;

    for (const item of junkItems) {
      try {
        await deleteFileOrDir(item.path);
        deletedCount++;
        const relativePath = path.relative(resolvedPath, item.path);
        console.log(chalk.green(`✓ Deleted: ${relativePath}`));
      } catch (error: any) {
        errorCount++;
        const relativePath = path.relative(resolvedPath, item.path);
        console.error(
          chalk.red(`✗ Failed to delete: ${relativePath} - ${error.message}`)
        );
      }
    }

    // Summary
    console.log(chalk.green(`\n✓ Cleanup complete!`));
    console.log(
      chalk.gray(
        `Deleted: ${deletedCount} item(s), Errors: ${errorCount}, Freed: ${formatSize(totalSize)}`
      )
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      process.exit(0);
    } else {
      console.error(chalk.red('Error during cleanup:'), error);
      process.exit(1);
    }
  }
}

