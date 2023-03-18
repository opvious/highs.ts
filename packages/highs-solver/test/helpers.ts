import path from 'path';

export function resourcePath(name: string): string {
  return path.join(__dirname, 'resources', name);
}
