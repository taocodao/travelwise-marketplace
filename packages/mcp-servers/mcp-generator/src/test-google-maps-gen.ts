import { MCPGenerator } from './generator';
import * as path from 'path';

async function main() {
    const generator = new MCPGenerator();
    const specUrl = path.join(__dirname, 'google-maps-spec.json');
    const mcpServersDir = path.resolve(__dirname, '../../'); // target: packages/mcp-servers

    console.log('--- Starting Test: Google Maps API Conversion ---');
    console.log(`Spec: ${specUrl}`);
    console.log(`Output: ${mcpServersDir}`);

    const result = await generator.generate({
        specUrl,
        serverName: 'google-maps',
        outputDir: mcpServersDir
    });

    console.log('Result:', result);
}

main().catch(console.error);
