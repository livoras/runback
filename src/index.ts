export function hello(name: string): string {
  return `Hello, ${name}!`;
}

if (require.main === module) {
  console.log(hello('World'));
} 