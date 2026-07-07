const fs = require('fs');
const path = require('path');

function processFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');

  const rules = [
    { regex: /(?<!dark:)bg-zinc-950(\/\d+)?/g, rep: 'bg-white dark:bg-zinc-950$1' },
    { regex: /(?<!dark:)bg-zinc-900(\/\d+)?/g, rep: 'bg-zinc-50 dark:bg-zinc-900$1' },
    { regex: /(?<!dark:)bg-zinc-850(\/\d+)?/g, rep: 'bg-zinc-100 dark:bg-zinc-850$1' },
    { regex: /(?<!dark:)bg-zinc-800(\/\d+)?/g, rep: 'bg-zinc-100 dark:bg-zinc-800$1' },
    { regex: /(?<!dark:)bg-zinc-700(\/\d+)?/g, rep: 'bg-zinc-200 dark:bg-zinc-700$1' },
    { regex: /(?<!dark:)text-zinc-500(\/\d+)?/g, rep: 'text-zinc-500 dark:text-zinc-500$1' },
    { regex: /(?<!dark:)text-zinc-400(\/\d+)?/g, rep: 'text-zinc-600 dark:text-zinc-400$1' },
    { regex: /(?<!dark:)text-zinc-300(\/\d+)?/g, rep: 'text-zinc-700 dark:text-zinc-300$1' },
    { regex: /(?<!dark:)text-zinc-200(\/\d+)?/g, rep: 'text-zinc-800 dark:text-zinc-200$1' },
    { regex: /(?<!dark:)text-zinc-100(\/\d+)?/g, rep: 'text-zinc-900 dark:text-zinc-100$1' },
    { regex: /(?<!dark:)text-white/g, rep: 'text-zinc-950 dark:text-white' },
    { regex: /(?<!dark:)border-zinc-850(\/\d+)?/g, rep: 'border-zinc-200 dark:border-zinc-850$1' },
    { regex: /(?<!dark:)border-zinc-800(\/\d+)?/g, rep: 'border-zinc-200 dark:border-zinc-800$1' },
    { regex: /(?<!dark:)border-zinc-700(\/\d+)?/g, rep: 'border-zinc-300 dark:border-zinc-700$1' },
    { regex: /(?<!dark:)divide-zinc-800(\/\d+)?/g, rep: 'divide-zinc-200 dark:divide-zinc-800$1' },
    { regex: /(?<!dark:)hover:bg-zinc-800(\/\d+)?/g, rep: 'hover:bg-zinc-200 dark:hover:bg-zinc-800$1' },
    { regex: /(?<!dark:)hover:bg-zinc-700(\/\d+)?/g, rep: 'hover:bg-zinc-300 dark:hover:bg-zinc-700$1' },
    { regex: /(?<!dark:)hover:text-white/g, rep: 'hover:text-zinc-900 dark:hover:text-white' },
    { regex: /(?<!dark:)hover:border-zinc-700(\/\d+)?/g, rep: 'hover:border-zinc-300 dark:hover:border-zinc-700$1' },
  ];

  for (const rule of rules) {
    text = text.replace(rule.regex, rule.rep);
  }

  fs.writeFileSync(filePath, text);
  console.log(`Processed ${filePath}`);
}

const dir = './src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
for (const file of files) {
  processFile(path.join(dir, file));
}
processFile('./src/App.tsx');
processFile('./src/index.css'); // Wait, we can't do this to css easily, we'll edit it manually
