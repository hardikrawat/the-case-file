import fs from 'fs';
import path from 'path';

const files = [
    'src/app/login/page.tsx',
    'src/app/signup/page.tsx',
    'src/app/signup/verify/page.tsx',
    'src/app/forgot-password/page.tsx',
    'src/app/reset-password/page.tsx'
];

const replacements: Record<string, string> = {
    'bg-[#0a0a0a]': 'bg-[#fdf6e3]',
    'bg-[#1c1917]': 'bg-white',
    'border-stone-800': 'border-stone-300',
    'text-stone-300': 'text-stone-800',
    'text-stone-400': 'text-stone-600',
    'text-stone-500': 'text-stone-500',
    'text-stone-200': 'text-stone-900',
    'text-amber-600': 'text-amber-700',
    'text-amber-700': 'text-amber-800',
    'bg-stone-800': 'bg-stone-200',
    'hover:bg-stone-700': 'hover:bg-stone-300',
    'placeholder-stone-700': 'placeholder-stone-400',
    'placeholder-stone-500': 'placeholder-stone-400',
    'border-stone-700': 'border-stone-300',
    'focus:bg-stone-900/30': 'focus:bg-stone-50',
    'from-stone-900 via-black to-black': 'from-stone-200 via-stone-100 to-[#fdf6e3]',
    'from-stone-950 via-stone-900 to-amber-950': 'from-[#fdf6e3] via-stone-100 to-amber-50',
    'bg-amber-900/10': 'bg-amber-500/10',
    'border-amber-800/50': 'border-amber-600/50',
    'bg-stone-900/50': 'bg-stone-100',
    'text-stone-700/30': 'text-stone-400/30',
    'text-stone-600': 'text-stone-500',
    'text-stone-950': 'text-white', // Button text when button is light, maybe text-stone-900? Let's use text-stone-900
    'bg-amber-950/20': 'bg-amber-50',
    'border-amber-900/30': 'border-amber-200',
    'bg-gradient-to-br': 'bg-gradient-to-br', // keeping
    'text-white': 'text-stone-900',
};

// Some specific fixes for buttons
replacements['text-stone-950'] = 'text-stone-900';

files.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf-8');
        
        for (const [dark, light] of Object.entries(replacements)) {
            // Replace all occurrences
            content = content.split(dark).join(light);
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`Updated theme classes in ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});
