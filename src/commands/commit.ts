import inquirer from 'inquirer';
import chalk from 'chalk';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface CommitOptions {
  push?: boolean;
}

const COMMIT_TYPES = [
  { name: 'feat: A new feature', value: 'feat' },
  { name: 'fix: A bug fix', value: 'fix' },
  { name: 'docs: Documentation only changes', value: 'docs' },
  { name: 'style: Changes that do not affect the meaning of the code', value: 'style' },
  { name: 'refactor: A code change that neither fixes a bug nor adds a feature', value: 'refactor' },
  { name: 'perf: A code change that improves performance', value: 'perf' },
  { name: 'test: Adding missing tests or correcting existing tests', value: 'test' },
  { name: 'build: Changes that affect the build system or external dependencies', value: 'build' },
  { name: 'ci: Changes to CI configuration files and scripts', value: 'ci' },
  { name: 'chore: Other changes that do not modify src or test files', value: 'chore' },
  { name: 'revert: Reverts a previous commit', value: 'revert' },
];

export async function commitCommand(options: CommitOptions = {}): Promise<void> {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'type',
        message: 'Select the type of commit:',
        choices: COMMIT_TYPES,
      },
      {
        type: 'input',
        name: 'scope',
        message: 'Enter the scope (optional, e.g., api, ui, db):',
        default: '',
      },
      {
        type: 'input',
        name: 'message',
        message: 'Enter the commit message:',
        validate: (input: string) => {
          if (!input.trim()) {
            return 'Commit message cannot be empty';
          }
          return true;
        },
      },
    ]);

    const { type, scope, message } = answers;
    
    // Ensure message starts with lowercase
    const formattedMessage = message.trim().charAt(0).toLowerCase() + message.trim().slice(1);
    
    // Build the commit message
    let commitMessage: string;
    if (scope && scope.trim()) {
      commitMessage = `${type}(${scope.trim()}): ${formattedMessage}`;
    } else {
      commitMessage = `${type}: ${formattedMessage}`;
    }

    // Display the generated commit message
    console.log('\n' + chalk.green('Generated commit message:'));
    console.log(chalk.cyan(commitMessage) + '\n');
    
    // If --push flag is set, commit and push
    if (options.push) {
      try {
        // Check if there are any changes to commit
        const { stdout: statusOutput } = await execAsync('git status --porcelain');
        if (!statusOutput.trim()) {
          console.log(chalk.yellow('No changes to commit. Working tree is clean.'));
          return;
        }

        // Stage all changes
        console.log(chalk.blue('Staging changes...'));
        await execAsync('git add -A');

        // Commit with the generated message
        console.log(chalk.blue('Committing changes...'));
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Get the current branch
        const { stdout: branchOutput } = await execAsync('git rev-parse --abbrev-ref HEAD');
        const currentBranch = branchOutput.trim();

        // Push to remote
        console.log(chalk.blue(`Pushing to origin/${currentBranch}...`));
        await execAsync(`git push origin ${currentBranch}`);

        console.log(chalk.green('\n✓ Successfully committed and pushed!'));
        console.log(chalk.gray(`Branch: ${currentBranch}\n`));
      } catch (gitError: any) {
        if (gitError.code === 'ENOENT') {
          console.error(chalk.red('Error: git is not installed or not found in PATH.'));
        } else if (gitError.code === 128) {
          console.error(chalk.red('Error: Not a git repository. Please run this command in a git repository.'));
        } else {
          console.error(chalk.red('Error during git operation:'), gitError.message);
        }
        process.exit(1);
      }
    } else {
      // Copy instruction
      console.log(chalk.gray('Copy the message above and use it with:'));
      console.log(chalk.gray(`git commit -m "${commitMessage}"`));
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      // User cancelled, exit gracefully
      process.exit(0);
    } else {
      console.error(chalk.red('Error generating commit message:'), error);
      process.exit(1);
    }
  }
}

