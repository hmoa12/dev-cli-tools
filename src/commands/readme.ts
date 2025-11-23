import inquirer from 'inquirer';
import chalk from 'chalk';
import { promises as fs } from 'fs';
import path from 'path';

const LICENSES = [
  { name: 'MIT', value: 'MIT' },
  { name: 'Apache-2.0', value: 'Apache-2.0' },
  { name: 'GPL-3.0', value: 'GPL-3.0' },
  { name: 'ISC', value: 'ISC' },
  { name: 'Unlicense', value: 'Unlicense' },
  { name: 'None', value: 'None' },
];

interface ReadmeOptions {
  noInstall?: boolean;
  minimal?: boolean;
  output?: string;
}

function generateReadmeTemplate(data: {
  projectName: string;
  description: string;
  installation?: string;
  usage?: string;
  license: string;
  minimal?: boolean;
}): string {
  const { projectName, description, installation, usage, license, minimal } = data;

  let readme = `# ${projectName}\n\n`;
  
  // Description
  readme += `${description}\n\n`;

  // Table of Contents (only if not minimal and multiple sections exist)
  if (!minimal && (installation || usage)) {
    readme += `## Table of Contents\n\n`;
    if (installation) {
      readme += `- [Installation](#installation)\n`;
    }
    if (usage) {
      readme += `- [Usage](#usage)\n`;
    }
    if (license && license !== 'None') {
      readme += `- [License](#license)\n`;
    }
    readme += `\n`;
  }

  // Installation section
  if (installation) {
    readme += `## Installation\n\n`;
    // Check if input already contains markdown code blocks
    if (installation.includes('```')) {
      // User provided formatted markdown, use as-is
      readme += `${installation}\n\n`;
    } else {
      // Format plain text - detect if it looks like commands
      const lines = installation.split('\n').filter(line => line.trim());
      
      // Check if content looks like command-line instructions
      const commandPatterns = [
        /^\$|^npm |^yarn |^pnpm |^git |^npm install|^npm i |^yarn add|^pnpm add|^\.\/|^node |^npx /
      ];
      
      const hasCommands = lines.some(line => 
        commandPatterns.some(pattern => pattern.test(line.trim()))
      );
      
      if (hasCommands) {
        // Format as code block
        readme += '```bash\n';
        lines.forEach(line => {
          // Remove $ prefix if present for cleaner code block
          const cleanedLine = line.trim().replace(/^\$+\s*/, '');
          readme += `${cleanedLine}\n`;
        });
        readme += '```\n\n';
      } else {
        // Format as regular text
        lines.forEach(line => {
          readme += `${line}\n`;
        });
        readme += `\n`;
      }
    }
  }

  // Usage section
  if (usage) {
    readme += `## Usage\n\n`;
    // Check if input already contains markdown code blocks
    if (usage.includes('```')) {
      // User provided formatted markdown, use as-is
      readme += `${usage}\n\n`;
    } else {
      // Format plain text - detect if it looks like commands
      const lines = usage.split('\n').filter(line => line.trim());
      
      // Check if content looks like command-line instructions or code
      const commandPatterns = [
        /^\$|^npm |^yarn |^pnpm |^git |^node |^npx |^\.\/|^import |^const |^function |^class /
      ];
      
      const hasCommands = lines.some(line => 
        commandPatterns.some(pattern => pattern.test(line.trim()))
      );
      
      if (hasCommands) {
        // Detect language (bash for commands, javascript for code)
        const isCode = /^(import|const|let|var|function|class|export)/.test(lines[0]?.trim() || '');
        const language = isCode ? 'javascript' : 'bash';
        
        readme += `\`\`\`${language}\n`;
        lines.forEach(line => {
          // Remove $ prefix if present for cleaner code block
          const cleanedLine = line.trim().replace(/^\$+\s*/, '');
          readme += `${cleanedLine}\n`;
        });
        readme += '```\n\n';
      } else {
        // Format as regular text
        lines.forEach(line => {
          readme += `${line}\n`;
        });
        readme += `\n`;
      }
    }
  }

  // License section
  if (license && license !== 'None') {
    readme += `## License\n\n`;
    readme += `This project is licensed under the ${license} License.\n\n`;
  }

  return readme;
}

export async function readmeCommand(options: ReadmeOptions = {}): Promise<void> {
  try {
    const { noInstall, minimal, output } = options;
    const outputPath = output ? path.resolve(output) : path.join(process.cwd(), 'README.md');

    // Check if file already exists
    try {
      await fs.access(outputPath);
      const overwriteAnswer = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `${chalk.yellow('README.md already exists.')} Do you want to overwrite it?`,
          default: false,
        },
      ]);

      if (!overwriteAnswer.overwrite) {
        console.log(chalk.gray('Operation cancelled.'));
        process.exit(0);
      }
    } catch (error) {
      // File doesn't exist, continue
    }

    // Build prompt questions
    const questions: any[] = [
      {
        type: 'input',
        name: 'projectName',
        message: 'Enter the project name:',
        validate: (input: string) => {
          if (!input.trim()) {
            return chalk.red('Project name cannot be empty. Please enter a valid project name.');
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        message: 'Enter the project description:',
        validate: (input: string) => {
          if (!input.trim()) {
            return chalk.red('Description cannot be empty. Please enter a project description.');
          }
          return true;
        },
      },
    ];

    // Add installation question if not minimal and not --no-install
    if (!minimal && !noInstall) {
      questions.push({
        type: 'editor',
        name: 'installation',
        message: 'Enter installation steps (optional - open editor, write your content, save and close to continue):',
        default: '',
      });
    }

    // Add usage question if not minimal
    if (!minimal) {
      questions.push({
        type: 'editor',
        name: 'usage',
        message: 'Enter usage examples (optional - open editor, write your content, save and close to continue):',
        default: '',
      });
    }

    // Add license question
    questions.push({
      type: 'list',
      name: 'license',
      message: 'Select a license:',
      choices: LICENSES,
      default: 'MIT',
    });

    // Prompt for answers
    const answers = await inquirer.prompt(questions);

    // Process installation - if empty string, convert to undefined
    const installation = answers.installation?.trim() || undefined;
    const usage = answers.usage?.trim() || undefined;

    // Generate README content
    const readmeContent = generateReadmeTemplate({
      projectName: answers.projectName.trim(),
      description: answers.description.trim(),
      installation,
      usage,
      license: answers.license,
      minimal: minimal || false,
    });

    // Write file
    try {
      // Ensure directory exists
      const dirPath = path.dirname(outputPath);
      await fs.mkdir(dirPath, { recursive: true });
      
      await fs.writeFile(outputPath, readmeContent, 'utf-8');
      console.log('\n' + chalk.green('✓ README.md generated successfully!'));
      console.log(chalk.gray(`File saved to: ${outputPath}\n`));
    } catch (error) {
      console.error(chalk.red('Error writing README.md:'), error);
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      // User cancelled, exit gracefully
      process.exit(0);
    } else {
      console.error(chalk.red('Error generating README:'), error);
      process.exit(1);
    }
  }
}

