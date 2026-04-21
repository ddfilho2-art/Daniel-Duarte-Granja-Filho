import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  // Check if .single() exists
  if (content.includes('.single()')) {
    // Basic replacement for supabase queries
    const newContent = content.replace(/\.single\(\)/g, '.maybeSingle()');
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(file)) {
        walkDir(fullPath);
      }
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(path.join(process.cwd(), 'src'));
