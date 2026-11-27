import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

// The engine must stay independent from React / React Native / Expo.
it('engine has no UI or platform imports', () => {
  const dir = join(__dirname, '..');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  for (const f of files) {
    const src = readFileSync(join(dir, f), 'utf8');
    expect(src).not.toMatch(/from ['"](react|react-native|expo)[^'"]*['"]/);
  }
});
