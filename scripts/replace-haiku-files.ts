import { readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { parse, resolve } from 'path';
import { Generator } from '../src/Generator';

function main() {
    const buildDir = resolve(process.cwd(), 'build');

    const files = readdirSync(resolve(buildDir, 'components'))
        .filter(f => f.endsWith('.haiku'))
        .map(f => resolve(buildDir, 'components', f));

    for (const file of files) {
        const fileContents = readFileSync(file, 'utf8');
        const componentName = parse(file).name;
        const fileDir = parse(file).dir;

        const { brs, xml } = Generator.generate(fileContents, componentName);

        writeFileSync(resolve(fileDir, `${componentName}.brs`), brs, 'utf8');
        writeFileSync(resolve(fileDir, `${componentName}.xml`), xml, 'utf8');
        rmSync(file);
    }
}

main();
